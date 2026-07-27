import assert from "node:assert"
import { describe, it } from "node:test"

import { type BookWithRelations } from "@/database/books"
import {
  type KoboDownloadUrl,
  buildKoboMetadata,
  buildNewEntitlement,
} from "@/kobo/metadata"

function book(
  overrides: Partial<{
    uuid: string
    title: string
    description: string | null
    language: string | null
    publicationDate: string | null
    authors: { name: string }[]
    series: { name: string; position: number | null }[]
  }> = {},
): BookWithRelations {
  // `in` rather than ??, so a test can pass an explicit null and actually
  // exercise the nullable path instead of silently getting the default.
  const pick = <K extends keyof typeof overrides>(
    key: K,
    fallback: NonNullable<(typeof overrides)[K]>,
  ) => (key in overrides ? overrides[key] : fallback)

  return {
    uuid: pick("uuid", "11111111-2222-3333-4444-555555555555"),
    title: pick("title", "The Dungeon Anarchist's Cookbook"),
    description: pick("description", "A book."),
    language: pick("language", "en"),
    publicationDate: pick("publicationDate", "2021-07-13"),
    authors: pick("authors", [{ name: "Matt Dinniman" }]),
    series: pick("series", []),
  } as unknown as BookWithRelations
}

const urls: KoboDownloadUrl[] = [
  {
    Format: "EPUB3",
    Size: 1234,
    Url: "https://storyteller.example/kobo/t/download/abc",
    Platform: "Generic",
  },
]

void describe("buildKoboMetadata", () => {
  void it("maps every id Kobo asks for onto the one book", () => {
    // The device treats these as distinct concepts; for us there is one
    // revision of one work, and they must agree or the book fails to appear.
    const m = buildKoboMetadata(book({ uuid: "abc-123" }), urls)
    for (const key of [
      "EntitlementId",
      "RevisionId",
      "CrossRevisionId",
      "WorkId",
      "CoverImageId",
    ]) {
      assert.strictEqual(m[key], "abc-123", `${key} must be the book uuid`)
    }
  })

  void it("carries the title, language and download urls through", () => {
    const m = buildKoboMetadata(book(), urls)
    assert.strictEqual(m["Title"], "The Dungeon Anarchist's Cookbook")
    assert.strictEqual(m["Language"], "en")
    assert.deepStrictEqual(m["DownloadUrls"], urls)
  })

  void it("omits a publication date rather than inventing one", () => {
    // A fabricated date would show up as fact on her device.
    const m = buildKoboMetadata(book({ publicationDate: null }), urls)
    assert.ok(!("PublicationDate" in m))

    const bad = buildKoboMetadata(book({ publicationDate: "not a date" }), urls)
    assert.ok(!("PublicationDate" in bad))
  })

  void it("emits an ISO timestamp for a real publication date", () => {
    const m = buildKoboMetadata(book({ publicationDate: "2021-07-13" }), urls)
    assert.match(m["PublicationDate"] as string, /^2021-07-13T/)
  })

  void it("groups a series under a stable id", () => {
    const a = buildKoboMetadata(
      book({ series: [{ name: "Dungeon Crawler Carl", position: 3 }] }),
      urls,
    )
    const b = buildKoboMetadata(
      book({
        uuid: "different-book",
        series: [{ name: "Dungeon Crawler Carl", position: 4 }],
      }),
      urls,
    )
    const seriesA = a["Series"] as Record<string, unknown>
    const seriesB = b["Series"] as Record<string, unknown>

    assert.strictEqual(seriesA["Name"], "Dungeon Crawler Carl")
    assert.strictEqual(seriesA["Number"], 3)
    // Same series name must land in the same Kobo group across books/syncs.
    assert.strictEqual(seriesA["Id"], seriesB["Id"])
    // A different series must not collide into that group.
    const other = buildKoboMetadata(
      book({ series: [{ name: "The Farseer Trilogy", position: 1 }] }),
      urls,
    )
    assert.notStrictEqual(
      (other["Series"] as Record<string, unknown>)["Id"],
      seriesA["Id"],
    )
  })

  void it("leaves Series off entirely for a standalone book", () => {
    assert.ok(!("Series" in buildKoboMetadata(book({ series: [] }), urls)))
  })

  void it("produces an id in uuid shape, which the device parses", () => {
    const m = buildKoboMetadata(
      book({ series: [{ name: "Anything", position: 1 }] }),
      urls,
    )
    const { Id } = m["Series"] as { Id: string }
    assert.match(
      Id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })
})

void describe("buildNewEntitlement", () => {
  void it("marks the book active and present so it shows up in her library", () => {
    const e = buildNewEntitlement(book(), urls, "2026-07-16T00:00:00Z") as {
      NewEntitlement: { BookEntitlement: Record<string, unknown> }
    }
    const entitlement = e.NewEntitlement.BookEntitlement
    assert.strictEqual(entitlement["Status"], "Active")
    assert.strictEqual(entitlement["IsRemoved"], false)
    assert.strictEqual(entitlement["IsLocked"], false)
    assert.strictEqual(entitlement["Accessibility"], "Full")
  })

  void it("ties the entitlement, metadata and reading state to the same book", () => {
    const e = buildNewEntitlement(book({ uuid: "same-id" }), urls, "t") as {
      NewEntitlement: {
        BookEntitlement: Record<string, unknown>
        BookMetadata: Record<string, unknown>
        ReadingState: Record<string, unknown>
      }
    }
    assert.strictEqual(e.NewEntitlement.BookEntitlement["Id"], "same-id")
    assert.strictEqual(
      e.NewEntitlement.BookMetadata["EntitlementId"],
      "same-id",
    )
    assert.strictEqual(
      e.NewEntitlement.ReadingState["EntitlementId"],
      "same-id",
    )
  })
})
