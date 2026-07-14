import assert from "node:assert"
import { describe, it } from "node:test"

import { type BookWithRelations } from "@/database/books"
import {
  canAlign,
  getAlignmentStatus,
  isAlignmentInFlight,
} from "@/work/alignmentStatus"

type Formats = {
  ebook?: { missing?: boolean } | null
  audiobook?: { missing?: boolean } | null
  readaloud?: {
    status?: "CREATED" | "QUEUED" | "PROCESSING" | "STOPPED" | "ERROR"
    filepath?: string | null
  } | null
}

/**
 * Only the four fields the alignment rules read. Building a whole
 * BookWithRelations would bury the case each test is actually making.
 */
function book({ ebook, audiobook, readaloud }: Formats): BookWithRelations {
  return {
    ebook: ebook ? { missing: ebook.missing ?? false } : null,
    audiobook: audiobook ? { missing: audiobook.missing ?? false } : null,
    readaloud: readaloud
      ? {
          status: readaloud.status ?? "CREATED",
          filepath: readaloud.filepath ?? null,
        }
      : null,
  } as unknown as BookWithRelations
}

void describe("canAlign", () => {
  void it("needs both an ebook and an audiobook", () => {
    assert.strictEqual(canAlign(book({ ebook: {}, audiobook: {} })), true)
    assert.strictEqual(canAlign(book({ ebook: {} })), false)
    assert.strictEqual(canAlign(book({ audiobook: {} })), false)
    assert.strictEqual(canAlign(book({})), false)
  })

  void it("rejects a format whose file has gone missing", () => {
    // The row still exists, so a presence-only check would wrongly pass here
    // and the alignment would fail at the first read.
    assert.strictEqual(
      canAlign(book({ ebook: { missing: true }, audiobook: {} })),
      false,
    )
    assert.strictEqual(
      canAlign(book({ ebook: {}, audiobook: { missing: true } })),
      false,
    )
  })
})

void describe("isAlignmentInFlight", () => {
  void it("is true while queued or running", () => {
    assert.strictEqual(
      isAlignmentInFlight(book({ readaloud: { status: "QUEUED" } })),
      true,
    )
    assert.strictEqual(
      isAlignmentInFlight(book({ readaloud: { status: "PROCESSING" } })),
      true,
    )
  })

  void it("is false once the run has ended, however it ended", () => {
    assert.strictEqual(
      isAlignmentInFlight(book({ readaloud: { status: "ERROR" } })),
      false,
    )
    assert.strictEqual(
      isAlignmentInFlight(book({ readaloud: { status: "STOPPED" } })),
      false,
    )
    assert.strictEqual(isAlignmentInFlight(book({})), false)
  })
})

void describe("getAlignmentStatus", () => {
  void it("calls a book with both formats and no readaloud ready", () => {
    assert.strictEqual(
      getAlignmentStatus(book({ ebook: {}, audiobook: {} })),
      "ready",
    )
  })

  void it("calls a book missing a format incomplete", () => {
    assert.strictEqual(getAlignmentStatus(book({ ebook: {} })), "incomplete")
    assert.strictEqual(
      getAlignmentStatus(book({ ebook: { missing: true }, audiobook: {} })),
      "incomplete",
    )
  })

  void it("reports a produced readaloud as aligned", () => {
    assert.strictEqual(
      getAlignmentStatus(
        book({
          ebook: {},
          audiobook: {},
          readaloud: { filepath: "/data/assets/Book/readaloud/Book.epub" },
        }),
      ),
      "aligned",
    )
  })

  void it("does not call a book aligned just because a readaloud row exists", () => {
    // A readaloud row is created when processing starts and outlives a failed
    // run, so its presence proves nothing on its own. This is the trap that
    // makes a naive "has readaloud" check report failures as successes.
    assert.strictEqual(
      getAlignmentStatus(
        book({
          ebook: {},
          audiobook: {},
          readaloud: { status: "ERROR", filepath: null },
        }),
      ),
      "failed",
    )
  })

  void it("reports queued and running books as in progress", () => {
    assert.strictEqual(
      getAlignmentStatus(
        book({ ebook: {}, audiobook: {}, readaloud: { status: "QUEUED" } }),
      ),
      "in-progress",
    )
    assert.strictEqual(
      getAlignmentStatus(
        book({ ebook: {}, audiobook: {}, readaloud: { status: "PROCESSING" } }),
      ),
      "in-progress",
    )
  })

  void it("reports a stopped run as failed, not as ready", () => {
    // Ready means "nothing has been tried yet". A stopped run needs a restart,
    // which is a different decision, so it must not hide among the ready books.
    assert.strictEqual(
      getAlignmentStatus(
        book({ ebook: {}, audiobook: {}, readaloud: { status: "STOPPED" } }),
      ),
      "failed",
    )
  })

  void it("prefers the failure over the missing format", () => {
    // A book can lose a file after a run failed. The failure is the actionable
    // fact: it explains the wreckage on disk that the operator has to clear.
    assert.strictEqual(
      getAlignmentStatus(
        book({
          ebook: { missing: true },
          readaloud: { status: "ERROR" },
        }),
      ),
      "failed",
    )
  })

  void it("keeps reporting a running book as in progress even mid-restart", () => {
    // A restart of an already aligned book keeps the old file on disk while it
    // runs. Reporting it as aligned would let an operator queue it twice.
    assert.strictEqual(
      getAlignmentStatus(
        book({
          ebook: {},
          audiobook: {},
          readaloud: {
            status: "PROCESSING",
            filepath: "/data/assets/Book/readaloud/Book.epub",
          },
        }),
      ),
      "in-progress",
    )
  })
})
