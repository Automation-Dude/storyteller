// Test doubles implement an async interface but need no await inside.
/* eslint-disable @typescript-eslint/require-await */
import assert from "node:assert"
import { describe, it } from "node:test"

import { type BookWithRelations } from "@/database/books"
import { type OpenLibraryCandidate } from "@/metadata/openLibrary"
import { applicableChoice } from "@/metadata/proposals"
import {
  type RepairProposal,
  type ResolveDeps,
  resolveBook,
} from "@/metadata/resolve"
import { type UUID } from "@/uuid"

const BOOK_UUID = "00000000-0000-0000-0000-000000000001" as UUID

function fakeBook(over: {
  title?: string
  authors?: string[]
  language?: string | null
  description?: string | null
  assetDir?: string | null
  series?: { name: string }[]
  ebook?: { filepath: string }
  audiobook?: { filepath: string }
}): BookWithRelations {
  return {
    uuid: BOOK_UUID,
    title: over.title ?? "A Perfectly Good Title",
    authors: (over.authors ?? []).map((name) => ({ name })),
    language: over.language ?? null,
    description: over.description ?? null,
    assetDir: over.assetDir ?? null,
    series: over.series ?? [],
    ebook: over.ebook ? { ...over.ebook, missing: false } : null,
    audiobook: over.audiobook ? { ...over.audiobook, missing: false } : null,
  } as unknown as BookWithRelations
}

function candidate(over: Partial<OpenLibraryCandidate>): OpenLibraryCandidate {
  return {
    workKey: "/works/OL1W",
    title: "Result Title",
    authors: ["Result Author"],
    firstPublishYear: 2000,
    coverId: 1,
    coverUrl: "https://covers/1-L.jpg",
    isbn: null,
    languages: ["eng"],
    editionCount: 10,
    editionKey: "/books/OL1M",
    ratingsAverage: 4.0,
    ratingsCount: 100,
    score: 0.9,
    ...over,
  }
}

/** Base deps that fail loudly if a test forgets to stub something it uses. */
function baseDeps(
  over: Partial<ResolveDeps>,
  book: BookWithRelations,
): ResolveDeps {
  return {
    loadBook: async () => book,
    readLocal: async () => ({}),
    search: async () => {
      throw new Error("search called unexpectedly")
    },
    fetchDescription: async () => null,
    fetchEditionSeries: async () => null,
    fetchWorkSeries: async () => null,
    hasCover: async () => false,
    narratorNames: async () => new Set<string>(),
    ...over,
  }
}

void describe("resolveBook", () => {
  void it("does nothing (and no I/O) when the book has no gaps", async () => {
    const book = fakeBook({
      title: "Good Title",
      authors: ["Jane Doe"],
      language: "en",
      description: "A real description that is plenty long enough.",
      series: [{ name: "A Series" }],
    })
    let readLocalCalled = false
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => {
            readLocalCalled = true
            return {}
          },
        },
        book,
      ),
    )
    assert.ok(res)
    assert.deepStrictEqual(res.choice, {})
    assert.strictEqual(res.confidence, "none")
    assert.strictEqual(
      readLocalCalled,
      false,
      "should not read files when nothing is missing",
    )
  })

  void it("fills from the book's own files and never hits the network", async () => {
    const book = fakeBook({
      title: "18 - Sharpe's Siege",
      authors: [],
      description: null,
      language: null,
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({
            title: "Sharpe's Siege",
            authors: ["Bernard Cornwell"],
            description:
              "Sharpe defends the fortress at the end of the Peninsular War.",
            language: "eng",
            series: { name: "Sharpe", position: 18 },
          }),
          // search stays the throwing default: it must not be called.
        },
        book,
      ),
    )
    assert.ok(res)
    assert.strictEqual(res.choice.title, "Sharpe's Siege")
    assert.strictEqual(res.sources.title, "file")
    assert.deepStrictEqual(res.choice.authors, ["Bernard Cornwell"])
    assert.strictEqual(res.sources.authors, "file")
    assert.strictEqual(res.sources.description, "file")
    assert.strictEqual(res.choice.language, "en", "eng normalised to en")
    assert.strictEqual(res.sources.language, "file")
    assert.deepStrictEqual(res.choice.series, { name: "Sharpe", position: 18 })
    assert.strictEqual(res.sources.series, "file")
    assert.strictEqual(res.best, null)
  })

  void it("fills the rest from one catalogue match, cleaning the query title first", async () => {
    const book = fakeBook({
      title: "DP15 - Atlantis Found",
      authors: [],
      description: null,
      language: null,
    })
    let searchedTitle = ""
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({}), // loose rip, no embedded metadata
          search: async (title) => {
            searchedTitle = title
            return [
              candidate({
                title: "Atlantis Found",
                authors: ["Clive Cussler"],
                languages: ["eng"],
                score: 0.92,
              }),
            ]
          },
          fetchDescription: async () =>
            "A Dirk Pitt adventure of a lost fleet beneath the ice.",
          hasCover: async () => false,
        },
        book,
      ),
    )
    assert.ok(res)
    assert.strictEqual(
      searchedTitle,
      "Atlantis Found",
      "catalogue searched by the cleaned title, not the raw one",
    )
    assert.strictEqual(res.choice.title, "Atlantis Found")
    assert.strictEqual(res.sources.title, "openlibrary")
    assert.deepStrictEqual(res.choice.authors, ["Clive Cussler"])
    assert.strictEqual(res.choice.language, "en")
    assert.ok(res.choice.description?.startsWith("A Dirk Pitt"))
    assert.strictEqual(res.sources.description, "openlibrary")
    assert.strictEqual(res.choice.coverUrl, "https://covers/1-L.jpg")
    assert.strictEqual(res.confidence, "high")
  })

  void it("lets a file value win: the catalogue never overwrites what the file supplied", async () => {
    const book = fakeBook({
      title: "DP02 - Iceberg",
      authors: [],
      description: null,
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          // File supplies only the description; title + author still needed.
          readLocal: async () => ({
            description:
              "The publisher's own embedded blurb, long enough to keep.",
          }),
          search: async () => [
            candidate({
              title: "Iceberg",
              authors: ["Clive Cussler"],
              score: 0.9,
            }),
          ],
          fetchDescription: async () =>
            "A DIFFERENT description from the catalogue that must not be used.",
        },
        book,
      ),
    )
    assert.ok(res)
    assert.strictEqual(res.sources.description, "file")
    assert.ok(res.choice.description?.startsWith("The publisher's own"))
    assert.strictEqual(res.sources.title, "openlibrary")
    assert.strictEqual(res.sources.authors, "openlibrary")
  })

  void it("writes nothing when the best match is too weak (guards against wrong books)", async () => {
    const book = fakeBook({ title: "Ta-cd-01", authors: [], description: null })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({}),
          search: async () => [
            candidate({ title: "Something Unrelated", score: 0.2 }),
          ],
          fetchDescription: async () => "should never be fetched",
        },
        book,
      ),
    )
    assert.ok(res)
    assert.deepStrictEqual(
      res.choice,
      {},
      "a sub-threshold match fills nothing",
    )
    assert.strictEqual(res.confidence, "none")
  })

  void it("files a book into its series from the title itself, no network", async () => {
    const book = fakeBook({
      title: "Wintersteel (Cradle Book 8)",
      authors: ["Will Wight"],
      language: "en",
      description:
        "A cradle book, description already present and long enough.",
    })
    const res = await resolveBook(BOOK_UUID, undefined, baseDeps({}, book))
    assert.ok(res)
    assert.deepStrictEqual(res.choice.series, { name: "Cradle", position: 8 })
    assert.strictEqual(res.sources.series, "file")
  })

  void it("takes the series from the matched edition only on a high-confidence match", async () => {
    const book = fakeBook({
      title: "Winters Heart",
      authors: ["Robert Jordan"],
      language: "en",
      description:
        "Long enough description so only the series is missing here.",
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({}),
          search: async () => [
            candidate({
              title: "Winter's Heart",
              authors: ["Robert Jordan"],
              score: 0.93,
            }),
          ],
          fetchEditionSeries: async () => ({
            name: "The Wheel of Time",
            position: 9,
          }),
        },
        book,
      ),
    )
    assert.ok(res)
    assert.deepStrictEqual(res.choice.series, {
      name: "The Wheel of Time",
      position: 9,
    })
    assert.strictEqual(res.sources.series, "openlibrary")
  })

  void it("refuses an edition series on a weak match", async () => {
    const book = fakeBook({
      title: "Some Ambiguous Title",
      authors: ["Somebody"],
      language: "en",
      description:
        "Long enough description so only the series is missing here.",
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({}),
          search: async () => [
            candidate({ title: "Some Ambiguous Title", score: 0.6 }),
          ],
          fetchEditionSeries: async () => {
            throw new Error("must not fetch series on a weak match")
          },
        },
        book,
      ),
    )
    assert.ok(res)
    assert.strictEqual(res.choice.series, undefined)
  })

  void it("does not overwrite a cover the book already has", async () => {
    const book = fakeBook({
      title: "Deep Six",
      authors: ["Clive Cussler"],
      language: "en",
      description: null,
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({}),
          search: async () => [
            candidate({
              title: "Deep Six",
              authors: ["Clive Cussler"],
              score: 0.95,
            }),
          ],
          fetchDescription: async () =>
            "Dirk Pitt races to stop a hijacked ship.",
          hasCover: async () => true, // already curated
        },
        book,
      ),
    )
    assert.ok(res)
    assert.strictEqual(res.sources.description, "openlibrary")
    assert.strictEqual(
      res.choice.coverUrl,
      undefined,
      "existing cover left alone",
    )
  })
})

void describe("applicableChoice", () => {
  const base: RepairProposal = {
    bookUuid: BOOK_UUID,
    currentTitle: "A Book",
    currentAuthors: [],
    choice: {},
    sources: {},
    candidates: [],
    best: null,
    confidence: "none",
  }

  void it("keeps file-sourced fills even when the catalogue was unsure", () => {
    // The catalogue's confidence says nothing about the book's own files; a
    // proposal like this used to be dropped entirely, gutting auto-repair.
    const applicable = applicableChoice({
      ...base,
      choice: {
        description: "From the epub's own OPF.",
        series: { name: "Cradle", position: 8 },
        authors: ["Guessed Author"],
      },
      sources: { description: "file", series: "file", authors: "openlibrary" },
      confidence: "low",
    })
    assert.deepStrictEqual(applicable, {
      description: "From the epub's own OPF.",
      series: { name: "Cradle", position: 8 },
    })
  })

  void it("keeps catalogue fills only on a confident match", () => {
    const proposal: RepairProposal = {
      ...base,
      choice: { description: "From the catalogue.", language: "en" },
      sources: { description: "openlibrary", language: "openlibrary" },
      confidence: "high",
    }
    assert.deepStrictEqual(applicableChoice(proposal), {
      description: "From the catalogue.",
      language: "en",
    })
    assert.deepStrictEqual(
      applicableChoice({ ...proposal, confidence: "low" }),
      {},
    )
  })
})

void describe("progressive discovery", () => {
  void it("walks cleaner title variants until the match is confident", async () => {
    const book = fakeBook({
      title: "Raising Steam: (Discworld novel 40) (Discworld series)",
      authors: ["Terry Pratchett"],
      language: "en",
      description: "Long enough description so only the series is missing.",
    })
    const queries: string[] = []
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({}),
          search: async (title) => {
            queries.push(title)
            // The cluttered form matches poorly; the stripped form is exact.
            if (title.includes("novel")) {
              return [candidate({ title: "Raising Steam", score: 0.55 })]
            }
            return [
              candidate({
                title: "Raising Steam",
                authors: ["Terry Pratchett"],
                score: 0.95,
              }),
            ]
          },
          fetchEditionSeries: async () => ({ name: "Discworld", position: 40 }),
        },
        book,
      ),
    )
    assert.ok(res)
    assert.ok(
      queries.length >= 2,
      `expected a ladder, got ${queries.join("; ")}`,
    )
    assert.strictEqual(res.confidence, "high")
    assert.deepStrictEqual(res.choice.series, {
      name: "Discworld",
      position: 40,
    })
  })

  void it("treats an author-confirmed overlap as confident despite a cluttered score", async () => {
    const book = fakeBook({
      title: "Witches Abroad",
      authors: ["Terry Pratchett"],
      language: "en",
      description: "Long enough description so only the series is missing.",
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({}),
          search: async () => [
            candidate({
              title: "Witches Abroad",
              authors: ["Terry Pratchett"],
              score: 0.6, // composite dragged down, but author + title agree
            }),
          ],
          fetchEditionSeries: async () => null,
          fetchWorkSeries: async () => ({ name: "Discworld", position: 12 }),
        },
        book,
      ),
    )
    assert.ok(res)
    assert.strictEqual(res.confidence, "high")
    assert.deepStrictEqual(res.choice.series, {
      name: "Discworld",
      position: 12,
    })
  })

  void it("lets a file-tag author confirm the match when the stored author is wrong", async () => {
    const book = fakeBook({
      title: "New Spring",
      authors: ["Wrong Person"], // plausible-looking, so it drives the query
      language: "en",
      description: null,
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({ authors: ["Robert Jordan"] }),
          search: async () => [
            candidate({
              title: "New Spring",
              authors: ["Robert Jordan"],
              // The wrong query author dragged the composite score down.
              score: 0.55,
            }),
          ],
          fetchDescription: async () =>
            "A prequel novel of the Wheel of Time, long before the Dragon.",
        },
        book,
      ),
    )
    assert.ok(res)
    assert.strictEqual(
      res.confidence,
      "high",
      "the file tag agreeing with the match confirms it",
    )
    assert.ok(res.choice.description?.startsWith("A prequel"))
  })

  void it("promotes a low match when the book's series clue agrees with the catalogue", async () => {
    const book = fakeBook({
      title: "The Fires of Heaven",
      authors: [],
      language: "en",
      description: null,
      series: [{ name: "The Wheel of Time" }],
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({}),
          search: async () => [
            candidate({
              title: "The Fires of Heaven (Wheel of Time, Book 5)",
              authors: ["Robert Jordan"],
              // Too few editions for canonical confirmation, no author signal.
              editionCount: 3,
              ratingsCount: 0,
              score: 0.5,
            }),
          ],
          fetchEditionSeries: async () => null,
          fetchWorkSeries: async () => ({
            name: "Wheel of Time",
            position: 5,
          }),
          fetchDescription: async () =>
            "The fifth entry of the Wheel of Time, long enough to keep.",
        },
        book,
      ),
    )
    assert.ok(res)
    assert.strictEqual(
      res.confidence,
      "high",
      "series agreement is independent confirmation",
    )
    assert.deepStrictEqual(res.choice.authors, ["Robert Jordan"])
  })

  void it("does not promote when the catalogue's series disagrees", async () => {
    const book = fakeBook({
      title: "The Fires of Heaven",
      authors: [],
      language: "en",
      description: null,
      series: [{ name: "The Wheel of Time" }],
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({}),
          search: async () => [
            candidate({
              title: "The Fires of Heaven (Wheel of Time, Book 5)",
              authors: ["Robert Jordan"],
              editionCount: 3,
              ratingsCount: 0,
              score: 0.5,
            }),
          ],
          fetchEditionSeries: async () => null,
          fetchWorkSeries: async () => ({ name: "Discworld", position: 12 }),
          fetchDescription: async () => "Long enough description to keep here.",
        },
        book,
      ),
    )
    assert.ok(res)
    assert.strictEqual(res.confidence, "low")
  })

  void it("does not let the ladder invent confidence for a wrong book", async () => {
    const book = fakeBook({
      title: "Some Obscure Memoir",
      authors: ["Nobody Famous"],
      language: "en",
      description: "Long enough description so only the series is missing.",
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({}),
          search: async () => [
            candidate({
              title: "A Different Book Entirely",
              authors: ["Someone Else"],
              score: 0.55,
            }),
          ],
          fetchEditionSeries: async () => {
            throw new Error("must not fetch series for an unconfirmed match")
          },
          fetchWorkSeries: async () => {
            throw new Error("must not fetch series for an unconfirmed match")
          },
        },
        book,
      ),
    )
    assert.ok(res)
    assert.strictEqual(res.confidence, "low")
    assert.strictEqual(res.choice.series, undefined)
  })
})

void describe("path signals in resolution", () => {
  void it("finds the author in the library tree when the row and tags have none", async () => {
    const book = fakeBook({
      title: "New Spring",
      authors: [],
      language: "en",
      description: null,
      ebook: {
        filepath: "/data/books/Robert Jordan/New Spring (12)/New Spring.epub",
      },
    })
    let searchedAuthor: string | undefined
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({}),
          search: async (_title, author) => {
            searchedAuthor = author
            return [
              candidate({
                title: "New Spring",
                authors: ["Robert Jordan"],
                editionCount: 3,
                ratingsCount: 0,
                score: 0.55,
              }),
            ]
          },
          fetchDescription: async () =>
            "A prequel of the Wheel of Time, long enough to keep here.",
        },
        book,
      ),
    )
    assert.ok(res)
    assert.strictEqual(
      searchedAuthor,
      "Robert Jordan",
      "the tree's author directory anchors the search",
    )
    assert.deepStrictEqual(res.choice.authors, ["Robert Jordan"])
    assert.strictEqual(res.sources.authors, "derived")
    assert.strictEqual(
      res.confidence,
      "high",
      "the path author agreeing with the match confirms it",
    )
  })

  void it("a publication year in the path confirms an uncertain match", async () => {
    const book = fakeBook({
      title: "The Time Machine",
      authors: [],
      language: "en",
      description: null,
      ebook: {
        filepath:
          "/data/assets/The Time Machine (1895)/text/The Time Machine.epub",
      },
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({}),
          search: async () => [
            candidate({
              title: "The Time Machine",
              authors: ["H. G. Wells"],
              firstPublishYear: 1895,
              // Too few editions for canonical confirmation on its own.
              editionCount: 3,
              ratingsCount: 0,
              score: 0.5,
            }),
          ],
          fetchDescription: async () =>
            "A Victorian scientist travels to the year 802701.",
        },
        book,
      ),
    )
    assert.ok(res)
    assert.strictEqual(
      res.confidence,
      "high",
      "year agreement is independent confirmation",
    )
    assert.deepStrictEqual(res.choice.authors, ["H. G. Wells"])
  })
})

void describe("author repair", () => {
  void it("derives the clean author from a damaged name, no network needed", async () => {
    const book = fakeBook({
      title: "Sharpe's Fortress",
      authors: ["By Bernard_Cornwell"],
      language: "en",
      description: "Long enough description so authors are the only problem.",
      series: [{ name: "Sharpe" }],
    })
    const res = await resolveBook(BOOK_UUID, undefined, baseDeps({}, book))
    assert.ok(res)
    assert.deepStrictEqual(res.choice.authors, ["Bernard Cornwell"])
    assert.strictEqual(res.sources.authors, "derived")
    // derived fills are safe for bulk apply regardless of catalogue confidence
    assert.deepStrictEqual(applicableChoice(res).authors, ["Bernard Cornwell"])
  })

  void it("never crowns the narrator: a narration credit waits for the catalogue", async () => {
    const book = fakeBook({
      title: "Sharpe's Devil",
      authors: ["Narrated by William Gaminara"],
      language: "en",
      description: "Long enough description so authors are the only problem.",
      series: [{ name: "Sharpe" }],
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({}),
          search: async () => [
            candidate({
              title: "Sharpe's Devil",
              authors: ["Bernard Cornwell"],
              score: 0.9,
            }),
          ],
        },
        book,
      ),
    )
    assert.ok(res)
    assert.deepStrictEqual(res.choice.authors, ["Bernard Cornwell"])
    assert.strictEqual(res.sources.authors, "openlibrary")
  })
})

void describe("wrong-population guards", () => {
  void it("never fills a narrator-only name as the author", async () => {
    const book = fakeBook({
      title: "Sharpe's Devil",
      authors: [],
      language: "en",
      description: "Long enough description so authors are the only problem.",
      series: [{ name: "Sharpe" }],
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          // The tags credit only the narrator, with no telltale prefix.
          readLocal: async () => ({ authors: ["William Gaminara"] }),
          narratorNames: async () => new Set(["william gaminara"]),
          search: async () => [
            candidate({
              title: "Sharpe's Devil",
              authors: ["Bernard Cornwell"],
              score: 0.9,
            }),
          ],
        },
        book,
      ),
    )
    assert.ok(res)
    assert.deepStrictEqual(
      res.choice.authors,
      ["Bernard Cornwell"],
      "the catalogue's author wins; the narrator is never proposed",
    )
    assert.strictEqual(res.sources.authors, "openlibrary")
  })

  void it("adopts the catalogue ordering for a reordered author name", async () => {
    const book = fakeBook({
      title: "The Bourne Legacy",
      authors: ["Ludlum Robert"],
      language: "en",
      description: null,
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({}),
          search: async () => [
            candidate({
              title: "The Bourne Legacy",
              authors: ["Robert Ludlum"],
              score: 0.9,
            }),
          ],
          fetchDescription: async () =>
            "Jason Bourne returns in a continuation long enough to keep.",
        },
        book,
      ),
    )
    assert.ok(res)
    assert.deepStrictEqual(res.choice.authors, ["Robert Ludlum"])
    assert.strictEqual(res.sources.authors, "openlibrary")
  })
})

void describe("author quality guards", () => {
  void it("never refills garbage from tags: a collection name is not an author", async () => {
    const book = fakeBook({
      title: "Brave New World",
      authors: ["Top 100 Sci-Fi Books"],
      language: "en",
      description: "Long enough description so authors are the only problem.",
      series: [{ name: "None" }],
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          // tags carry the same garbage the database has
          readLocal: async () => ({ authors: ["Top 100 Sci-Fi Books"] }),
          search: async () => [
            candidate({
              title: "Brave New World",
              authors: ["Aldous Huxley"],
              score: 0.95,
            }),
          ],
        },
        book,
      ),
    )
    assert.ok(res)
    assert.deepStrictEqual(res.choice.authors, ["Aldous Huxley"])
    assert.strictEqual(res.sources.authors, "openlibrary")
  })

  void it("cleans tag-sourced authors before trusting them", async () => {
    const book = fakeBook({
      title: "Vagabond",
      authors: [],
      language: "en",
      description: "Long enough description so authors are the only problem.",
      series: [{ name: "Grail Quest" }],
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        { readLocal: async () => ({ authors: ["Bernard_Cornwell"] }) },
        book,
      ),
    )
    assert.ok(res)
    assert.deepStrictEqual(res.choice.authors, ["Bernard Cornwell"])
    assert.strictEqual(res.sources.authors, "file")
  })

  void it("adopts the catalogue spelling when the stored author is a typo away", async () => {
    const book = fakeBook({
      title: "Dragonsong",
      authors: ["Anne McCaffery"],
      language: "en",
      description: "Long enough description so nothing else is missing here.",
    })
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          readLocal: async () => ({}),
          search: async () => [
            candidate({
              title: "Dragonsong",
              authors: ["Anne McCaffrey"],
              score: 0.95,
            }),
          ],
          fetchEditionSeries: async () => ({
            name: "Dragonriders of Pern",
            position: 3,
          }),
        },
        book,
      ),
    )
    assert.ok(res)
    assert.deepStrictEqual(res.choice.authors, ["Anne McCaffrey"])
    assert.strictEqual(res.sources.authors, "openlibrary")
  })
})

void describe("search base title", () => {
  void it("a healthy stored title outranks tag titles for the search", async () => {
    const book = fakeBook({
      title: "Dune",
      authors: ["Top 100 Sci-Fi Books"],
      language: "en",
      description: "Long enough description so authors are the only problem.",
      series: [{ name: "Dune" }],
    })
    const queries: string[] = []
    const res = await resolveBook(
      BOOK_UUID,
      undefined,
      baseDeps(
        {
          // tags carry a mangled rip title AND a garbage author
          readLocal: async () => ({
            title: "01 - Dune - Frank Herbert - 1965",
            authors: ["Top 100 Sci-Fi Books"],
          }),
          search: async (title) => {
            queries.push(title)
            if (title === "Dune") {
              return [
                candidate({
                  title: "Dune",
                  authors: ["Frank Herbert"],
                  editionCount: 120,
                  score: 0.75,
                }),
              ]
            }
            return [candidate({ title: "The notebooks of Dune", score: 0.45 })]
          },
        },
        book,
      ),
    )
    assert.ok(res)
    assert.ok(queries.includes("Dune"), `searched: ${queries.join("; ")}`)
    // no usable author + exact title on a canonical work = confident
    assert.strictEqual(res.confidence, "high")
    assert.deepStrictEqual(res.choice.authors, ["Frank Herbert"])
  })
})
