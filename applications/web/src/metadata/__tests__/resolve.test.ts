// Test doubles implement an async interface but need no await inside.
/* eslint-disable @typescript-eslint/require-await */
import assert from "node:assert"
import { describe, it } from "node:test"

import { type BookWithRelations } from "@/database/books"
import { type OpenLibraryCandidate } from "@/metadata/openLibrary"
import {
  type RepairProposal,
  type ResolveDeps,
  applicableChoice,
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
}): BookWithRelations {
  return {
    uuid: BOOK_UUID,
    title: over.title ?? "A Perfectly Good Title",
    authors: (over.authors ?? []).map((name) => ({ name })),
    language: over.language ?? null,
    description: over.description ?? null,
    assetDir: over.assetDir ?? null,
    series: over.series ?? [],
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
    hasCover: async () => false,
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
