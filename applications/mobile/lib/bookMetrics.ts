import type { BookWithRelations } from "@/database/books"

export function bookPageCount(book: BookWithRelations): number | null {
  return (
    book.pageCount ?? book.ebook?.pageCount ?? book.readaloud?.pageCount ?? null
  )
}

export function bookDuration(book: BookWithRelations): number | null {
  return (
    book.duration ??
    book.audiobook?.duration ??
    book.readaloud?.duration ??
    null
  )
}
