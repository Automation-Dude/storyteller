import assert from "node:assert"
import { describe, it } from "node:test"

import {
  authorNameIsBad,
  cleanAuthorName,
  cleanTitle,
  combine,
  isGarbageTitle,
  seriesFromTitle,
  seriesPrefixTitle,
} from "@/metadata/localSignals"

// The same real problematic samples the Python prototype was proven against,
// so the ported logic can't silently drift from what was validated on the server.
void describe("localSignals.combine", () => {
  const cases: {
    label: string
    dbTitle: string
    assetDir: string
    filename?: string
    signals?: Parameters<typeof combine>[3]
    expect: { author?: string; title?: string; series?: string }
  }[] = [
    {
      label: "author in filename, real title buried in folder",
      dbTitle: "Hobb - Liveship Traders - Book 01 -  Ship of Magic",
      assetDir: "Hobb - Liveship Traders - Book 01 - Ship of Magic",
      filename: "Robin Hobb - Ship of Magic - 01 of 85.mp3",
      expect: {
        author: "Robin Hobb",
        title: "Ship of Magic",
        series: "Liveship Traders",
      },
    },
    {
      label: "author + year in folder",
      dbTitle:
        "12 - Do Androids Dream of Electric Sheep- - Philip K. Dick - 1968",
      assetDir:
        "12 - Do Androids Dream of Electric Sheep- - Philip K. Dick - 1968",
      expect: {
        author: "Philip K. Dick",
        title: "Do Androids Dream of Electric Sheep",
      },
    },
    {
      label: "garbage 'Side 19' filename must lose to folder title",
      dbTitle: "18 - Sharpe's Siege",
      assetDir: "18 - Sharpe's Siege",
      filename: "Side 19.mp3",
      expect: { title: "Sharpe's Siege" },
    },
    {
      label: "garbage 'T23' album tag must lose to folder title",
      dbTitle: "DP15 - Atlantis Found",
      assetDir: "DP15 - Atlantis Found",
      filename: "T23 - Atlantis Found.mp3",
      signals: { tags: { album: "T23 - Atlantis Found" } },
      expect: { title: "Atlantis Found" },
    },
    {
      label: "title-cased title, trailing year places the author",
      dbTitle: "17 - The Time Machine - H.G. Wells - 1895",
      assetDir: "17 - The Time Machine - H.G. Wells - 1895",
      expect: { author: "H.G. Wells", title: "The Time Machine" },
    },
    {
      label: "Title - Series Book N, series must not eat the title",
      dbTitle: "Castle of Wizardry - Belgariad Book 4",
      assetDir: "Castle of Wizardry - Belgariad Book 4",
      expect: { title: "Castle of Wizardry", series: "Belgariad" },
    },
    {
      label: "metadata.json is authoritative",
      dbTitle: "The Way of Kings",
      assetDir: "The Way of Kings [B07148FNJ3]",
      signals: {
        mj: {
          authors: ["Brandon Sanderson"],
          title: "The Way of Kings",
          series: "The Stormlight Archive",
        },
      },
      expect: {
        author: "Brandon Sanderson",
        title: "The Way of Kings",
        series: "The Stormlight Archive",
      },
    },
    {
      label: "'By ' prefix on the tag artist is stripped",
      dbTitle: "Sharpe's Ransom",
      assetDir: "Sharpe's Ransom",
      signals: {
        tags: { artist: "By Bernard Cornwell", album: "Sharpe's Ransom" },
      },
      expect: { author: "Bernard Cornwell", title: "Sharpe's Ransom" },
    },
  ]

  for (const c of cases) {
    void it(c.label, () => {
      const got = combine(c.dbTitle, c.assetDir, c.filename, c.signals)
      for (const [k, v] of Object.entries(c.expect)) {
        assert.strictEqual(
          (got[k as keyof typeof got] ?? "").toLowerCase(),
          v.toLowerCase(),
          `${k}: got ${JSON.stringify(got[k as keyof typeof got])}`,
        )
      }
    })
  }
})

void describe("localSignals guards", () => {
  void it("rejects bare disc/track/catalogue labels", () => {
    for (const junk of ["Side 19", "Disc 3", "01 of 30", "D01-11"]) {
      const cleaned = cleanTitle(junk)
      assert.ok(
        !cleaned || isGarbageTitle(cleaned),
        `expected junk rejected: ${junk} -> ${cleaned}`,
      )
    }
  })

  void it("finds a series wrapped inside the title, in every observed form", () => {
    const cases: [string, string, number | null][] = [
      ["Wintersteel (Cradle Book 8)", "Cradle", 8],
      ["Bloodline (Cradle Book 9)", "Cradle", 9],
      [
        "A Clash of Kings: A Song of Ice and Fire, Book II",
        "A Song of Ice and Fire",
        2,
      ],
      ["Dead Zero - Bob Lee Swagger Series, Book 7", "Bob Lee Swagger", 7],
      [
        "The Fires of Heaven: Book Five of The Wheel of Time",
        "The Wheel of Time",
        5,
      ],
      ["Blue Mars (Mars Trilogy Book 3)", "Mars", 3],
    ]
    for (const [raw, name, position] of cases) {
      const got = seriesFromTitle(raw)
      assert.ok(got, `expected a series from ${raw}`)
      assert.strictEqual(got.name.toLowerCase(), name.toLowerCase(), raw)
      assert.strictEqual(got.position, position, raw)
    }
  })

  void it("refuses to invent a series from a plain title", () => {
    for (const plain of [
      "The Martian",
      "Catch 22",
      "2001: A Space Odyssey",
      "Fahrenheit 451",
      "Greenlights",
    ]) {
      assert.strictEqual(seriesFromTitle(plain), null, plain)
    }
  })

  void it("keeps real titles, including legit trailing numbers", () => {
    for (const good of [
      "Atlantis Found",
      "Sharpe's Siege",
      "Catch 22",
      "Fahrenheit 451",
      "47th Samurai",
      "2001: A Space Odyssey",
    ]) {
      const cleaned = cleanTitle(good)
      assert.ok(
        cleaned && !isGarbageTitle(cleaned),
        `expected kept: ${good} -> ${cleaned}`,
      )
    }
  })
})

void describe("author name repair", () => {
  void it("flags damaged author strings", () => {
    for (const bad of [
      "By Bernard Cornwell",
      "Narrated by William Gaminara",
      "Bernard_Cornwell",
      "Cornwell, Bernard",
      "",
    ]) {
      assert.ok(authorNameIsBad(bad), bad)
    }
  })

  void it("leaves real names alone", () => {
    for (const good of [
      "Bernard Cornwell",
      "J. K. Rowling",
      "Ursula K. Le Guin",
      "Madeline Miller",
    ]) {
      assert.ok(!authorNameIsBad(good), good)
    }
  })

  void it("recovers the person from a damaged form", () => {
    assert.strictEqual(
      cleanAuthorName("By Bernard Cornwell"),
      "Bernard Cornwell",
    )
    assert.strictEqual(cleanAuthorName("Bernard_Cornwell"), "Bernard Cornwell")
    assert.strictEqual(cleanAuthorName("Cornwell, Bernard"), "Bernard Cornwell")
    assert.strictEqual(cleanAuthorName("  J. K. Rowling "), "J. K. Rowling")
  })
})


void describe("series from a ripped-folder title", () => {
  void it("reads the series, number and real title from '<Series> NN - Title'", () => {
    assert.deepStrictEqual(
      seriesFromTitle("Artemis Fowl 07 - The Atlantis Complex"),
      { name: "Artemis Fowl", position: 7 },
    )
    assert.deepStrictEqual(seriesFromTitle("Discworld 40 - Raising Steam"), {
      name: "Discworld",
      position: 40,
    })
    assert.strictEqual(
      seriesPrefixTitle("Artemis Fowl 07 - The Atlantis Complex"),
      "The Atlantis Complex",
    )
  })

  void it("does not invent a series for a standalone book", () => {
    for (const standalone of ["Yes Please", "The Diamond Throne", "Catch 22", "1984"]) {
      assert.strictEqual(seriesFromTitle(standalone), null, standalone)
      assert.strictEqual(seriesPrefixTitle(standalone), null, standalone)
    }
  })
})


void describe("handle-style authors are not names", () => {
  void it("flags a username with an internal dot", () => {
    assert.ok(authorNameIsBad("NYC.HarDCorE"))
    assert.ok(authorNameIsBad("nobody.xyz"))
  })
  void it("leaves real names, including dotted and single-token pen names", () => {
    for (const good of ["J. K. Rowling", "J.R.R. Tolkien", "pirateaba", "Homer"]) {
      assert.ok(!authorNameIsBad(good), good)
    }
  })
})
