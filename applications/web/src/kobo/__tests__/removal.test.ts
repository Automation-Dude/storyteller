import assert from "node:assert"
import { describe, it } from "node:test"

import { type BookWithRelations } from "@/database/books"
import { buildNewEntitlement, buildRemovedEntitlement } from "@/kobo/metadata"

function book(uuid: string): BookWithRelations {
  return {
    uuid,
    title: "A Book",
    description: null,
    language: "en",
    publicationDate: null,
    authors: [],
    series: [],
  } as unknown as BookWithRelations
}

void describe("buildRemovedEntitlement", () => {
  void it("tells the device the book is gone", () => {
    // Without IsRemoved, taking a book off a shelf does nothing at all and the
    // device keeps it forever.
    const e = buildRemovedEntitlement("book-1", "2026-07-16T00:00:00Z") as {
      ChangedEntitlement: { BookEntitlement: Record<string, unknown> }
    }
    const entitlement = e.ChangedEntitlement.BookEntitlement
    assert.strictEqual(entitlement["IsRemoved"], true)
    assert.strictEqual(entitlement["IsHiddenFromArchive"], true)
    assert.strictEqual(entitlement["Id"], "book-1")
  })

  void it("is a Changed, not a New, entitlement", () => {
    // A device only understands a removal as a change to something it holds.
    const e = buildRemovedEntitlement("book-1", "t")
    assert.ok("ChangedEntitlement" in e)
    assert.ok(!("NewEntitlement" in e))
  })

  void it("is the exact inverse of adding the same book", () => {
    const added = buildNewEntitlement(book("same"), [], "t") as {
      NewEntitlement: { BookEntitlement: Record<string, unknown> }
    }
    const removed = buildRemovedEntitlement("same", "t") as {
      ChangedEntitlement: { BookEntitlement: Record<string, unknown> }
    }

    // Same book, opposite state: the device matches them up by Id.
    assert.strictEqual(
      added.NewEntitlement.BookEntitlement["Id"],
      removed.ChangedEntitlement.BookEntitlement["Id"],
    )
    assert.strictEqual(added.NewEntitlement.BookEntitlement["IsRemoved"], false)
    assert.strictEqual(
      removed.ChangedEntitlement.BookEntitlement["IsRemoved"],
      true,
    )
  })
})
