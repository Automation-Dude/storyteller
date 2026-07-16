import assert from "node:assert"
import { describe, it } from "node:test"

import { seedBooks, setupTestDb } from "@/__tests__/harness/testDb"
import { getSectionFacets } from "@/database/libraryCounts"
import { type UUID } from "@/uuid"

const userId = "11111111-1111-1111-1111-111111111111" as UUID

void describe("getSectionFacets formats", () => {
  void it("partitions books into the exclusive format buckets", async () => {
    using ctx = setupTestDb()

    seedBooks(ctx, [
      // aligned readaloud (ebook + audiobook + aligned) -> readaloud
      { title: "synced", ebook: "e.epub", audiobook: "a.mp3", readaloud: "r" },
      // audiobook only
      { title: "audio", audiobook: "a.mp3" },
      // ebook only
      { title: "book", ebook: "e.epub" },
      // ebook + audiobook, no readaloud -> audiobook-ebook (missing readaloud)
      { title: "both", ebook: "e.epub", audiobook: "a.mp3" },
      // no media
      { title: "empty" },
    ])

    const facets = await getSectionFacets(userId, "formats")
    const byKey = Object.fromEntries(facets.map((f) => [f.key, f.bookCount]))

    assert.strictEqual(byKey["readaloud"], 1)
    assert.strictEqual(byKey["audiobook-only"], 1)
    assert.strictEqual(byKey["ebook-only"], 1)
    assert.strictEqual(byKey["audiobook-ebook"], 1)
    assert.strictEqual(byKey["no-media"], 1)
  })
})
