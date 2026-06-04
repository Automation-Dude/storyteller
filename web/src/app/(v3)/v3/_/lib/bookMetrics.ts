import type { BookWithRelations } from "@/database/books"

export function bookPageCount(book: BookWithRelations): number | null {
  return (
    book.pageCount ?? book.readaloud?.pageCount ?? book.ebook?.pageCount ?? null
  )
}

export function bookDuration(book: BookWithRelations): number | null {
  return (
    book.duration ??
    book.readaloud?.duration ??
    book.audiobook?.duration ??
    null
  )
}
