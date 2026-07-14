import { type BookWithRelations } from "@/database/books"

/**
 * Where a book sits on the road to a readaloud, from an operator's point of
 * view rather than the database's.
 *
 * The readaloud table records six raw states, but only some of them are
 * actionable, and the state an operator most needs ("this book could be
 * aligned but never has been") is not stored at all: it is the absence of a
 * readaloud combined with the presence of both source formats.
 */
export type AlignmentStatus =
  /** Both source formats are present, and no readaloud has been produced. */
  | "ready"
  /** Queued behind other books, or being aligned right now. */
  | "in-progress"
  /** Alignment ran and did not finish. Can be started again. */
  | "failed"
  /** A readaloud has been produced. */
  | "aligned"
  /** Missing an ebook or an audiobook, so it cannot be aligned as it stands. */
  | "incomplete"

/**
 * Whether a book has everything alignment needs: an ebook and an audiobook,
 * both actually present on disk.
 *
 * This is the single definition of the precondition. The process endpoint
 * rejects anything that fails it, and the library filter uses it to show
 * which books are worth queueing, so the two can never disagree.
 */
export function canAlign(book: BookWithRelations): boolean {
  const hasEbook = !!book.ebook && !book.ebook.missing
  const hasAudiobook = !!book.audiobook && !book.audiobook.missing

  return hasEbook && hasAudiobook
}

/**
 * Whether a readaloud has actually been produced for this book.
 *
 * A readaloud row can exist without a file: it is created when processing
 * starts and outlives a failed run, so its presence alone proves nothing.
 */
export function isAligned(book: BookWithRelations): boolean {
  return !!book.readaloud?.filepath
}

/**
 * Whether alignment is queued or running, which means the book should be left
 * alone rather than restarted or have its cache cleared.
 */
export function isAlignmentInFlight(book: BookWithRelations): boolean {
  const status = book.readaloud?.status

  return status === "QUEUED" || status === "PROCESSING"
}

export function getAlignmentStatus(book: BookWithRelations): AlignmentStatus {
  if (isAlignmentInFlight(book)) return "in-progress"
  if (isAligned(book)) return "aligned"

  // A book can be missing a format and still carry the wreckage of an earlier
  // run. Report the failure, which is the actionable fact, rather than the
  // missing format.
  const status = book.readaloud?.status
  if (status === "ERROR" || status === "STOPPED") return "failed"

  if (!canAlign(book)) return "incomplete"

  return "ready"
}
