import assert from "node:assert"
import { describe, it } from "node:test"

import {
  authorsMatch,
  bestTitleSimilarity,
  normalizeForSearch,
  queryVariants,
  scoreMatch,
  seriesNamesMatch,
  titleSimilarity,
} from "@/metadata/titleCleaning"

void describe("normalizeForSearch", () => {
  void it("strips ingestion junk to a searchable title", () => {
    const cases: [string, string][] = [
      ["02 - Dune - Frank Herbert - 1965", "Dune Frank Herbert"],
      ["DP19 - Treasure of Khan", "Treasure of Khan"],
      ["18 - Sharpe's Siege", "Sharpe's Siege"],
      ["08 Executive Orders", "Executive Orders"],
      ["The Hobbit (Disc 01)", "The Hobbit"],
      ["The road [A85UyqsZ]", "The road"],
      ["2. Winter of the World", "Winter of the World"],
    ]
    for (const [raw, expected] of cases) {
      assert.strictEqual(normalizeForSearch(raw), expected, raw)
    }
  })

  void it("strips series/volume suffixes so the real title is searched", () => {
    const cases: [string, string][] = [
      ["A Clash of Kings: A Song of Ice and Fire, Book II", "A Clash of Kings"],
      ["Bloodline (Cradle Book 9)", "Bloodline"],
      ["Blue Mars (Mars Trilogy Book 3)", "Blue Mars"],
      [
        "A Game of Thrones: A Song of Ice and Fire, Book I",
        "A Game of Thrones",
      ],
    ]
    for (const [raw, expected] of cases) {
      assert.strictEqual(normalizeForSearch(raw), expected, raw)
    }
  })

  void it("keeps a numeric title that is the whole title", () => {
    // The junk filters must never eat the title itself.
    assert.strictEqual(normalizeForSearch("1984"), "1984")
    assert.strictEqual(
      normalizeForSearch("2001: A Space Odyssey"),
      "2001: A Space Odyssey",
    )
  })

  void it("drops a year only when it is set off, not when it is the title", () => {
    assert.strictEqual(normalizeForSearch("Book (1965)"), "Book")
    assert.strictEqual(normalizeForSearch("1984"), "1984")
  })
})

void describe("titleSimilarity", () => {
  void it("is 1 for the same title regardless of case, punctuation, articles", () => {
    assert.strictEqual(titleSimilarity("The Road", "the road"), 1)
    assert.strictEqual(titleSimilarity("Wicked", "wicked!"), 1)
  })

  void it("is low for unrelated titles", () => {
    assert.ok(titleSimilarity("Dune", "Executive Orders") < 0.2)
  })
})

void describe("authorsMatch", () => {
  void it("matches on a shared surname", () => {
    assert.ok(authorsMatch("Cornwell", "Bernard Cornwell"))
    assert.ok(authorsMatch("Frank Herbert", "Herbert, Frank"))
  })

  void it("does not match different authors", () => {
    assert.ok(!authorsMatch("Frank Herbert", "Tom Clancy"))
    assert.ok(!authorsMatch("Top 100 Sci-Fi Books", "Frank Herbert"))
  })
})

void describe("seriesNamesMatch", () => {
  void it("matches the same series through articles and suffixes", () => {
    assert.ok(seriesNamesMatch("The Wheel of Time", "Wheel of Time"))
    assert.ok(seriesNamesMatch("Discworld series", "Discworld"))
    assert.ok(seriesNamesMatch("Dune Chronicles", "Dune"))
    assert.ok(seriesNamesMatch("Sharpe", "the Sharpe books"))
  })

  void it("rejects different series and empty names", () => {
    assert.ok(!seriesNamesMatch("The Wheel of Time", "Discworld"))
    assert.ok(!seriesNamesMatch("", "Discworld"))
    assert.ok(!seriesNamesMatch("The", "A"))
  })
})

void describe("scoreMatch", () => {
  void it("scores an exact title + author near the top", () => {
    const score = scoreMatch(
      { title: "Wicked", authorNames: ["Gregory Maguire"], editionCount: 54 },
      "Wicked",
      "Gregory Maguire",
    )
    assert.ok(score > 0.9, `expected > 0.9, got ${score}`)
  })

  void it("pushes down a study guide / adaptation of the right title", () => {
    const real = scoreMatch(
      { title: "1984", authorNames: ["George Orwell"], editionCount: 8 },
      "1984",
      "George Orwell",
    )
    const adaptation = scoreMatch(
      {
        title: "1984 (adaptation)",
        authorNames: ["Michael Dean", "George Orwell"],
        editionCount: 4,
      },
      "1984",
      "George Orwell",
    )
    assert.ok(
      real > adaptation,
      `real ${real} should beat adaptation ${adaptation}`,
    )
  })

  void it("pushes an omnibus / box set below the individual book", () => {
    const single = scoreMatch(
      {
        title: "A Dance with Dragons",
        authorNames: ["George R. R. Martin"],
        editionCount: 40,
      },
      "A Dance With Dragons",
      "George R. R. Martin",
    )
    const omnibus = scoreMatch(
      {
        title:
          "A Song of Ice and Fire (A Game of Thrones / A Clash of Kings / A Storm of Swords / A Feast for Crows / A Dance with Dragons)",
        authorNames: ["George R. R. Martin"],
        editionCount: 60,
      },
      "A Dance With Dragons",
      "George R. R. Martin",
    )
    assert.ok(
      single > omnibus,
      `single ${single} should beat omnibus ${omnibus}`,
    )
  })

  void it("still ranks the right book first when the stored author is wrong", () => {
    // "02 - Dune" carries a bogus author; the real book must still win.
    const dune = scoreMatch(
      { title: "Dune", authorNames: ["Frank Herbert"], editionCount: 120 },
      "Dune Frank Herbert",
      "Top 100 Sci-Fi Books",
    )
    const unrelated = scoreMatch(
      {
        title: "Executive Orders",
        authorNames: ["Tom Clancy"],
        editionCount: 8,
      },
      "Dune Frank Herbert",
      "Top 100 Sci-Fi Books",
    )
    assert.ok(dune > unrelated, `${dune} vs ${unrelated}`)
  })
})

void describe("queryVariants for series-prefixed titles", () => {
  void it("adds the bare title so the real book can be found", () => {
    const variants = queryVariants("Artemis Fowl 07 - The Atlantis Complex")
    assert.ok(
      variants.includes("The Atlantis Complex"),
      `variants: ${variants.join("; ")}`,
    )
  })
})

void describe("bestTitleSimilarity ignores a series parenthetical", () => {
  void it("matches a work catalogued with its series against the bare title", () => {
    assert.ok(
      bestTitleSimilarity(
        "The Diamond Throne (The Elenium)",
        "The Diamond Throne",
      ) >= 0.95,
    )
  })
})
