import { type BookWithRelations } from "@/database/books"
import { type MediaFilter } from "@/store/api"

import { type SortDirection, type SortField } from "@v3/_/components/books"

export type ClientFilterOptions = {
  search?: string | undefined
  sortField?: SortField | undefined
  sortDirection?: SortDirection | undefined
  mediaFilter?: MediaFilter | undefined
  statusFilter?: string | null | undefined
}

export function filterBooksClientSide(
  books: BookWithRelations[],
  options: ClientFilterOptions,
): BookWithRelations[] {
  let result = books

  if (options.search) {
    const term = options.search.toLowerCase()

    result = result.filter((book) => {
      const searchableText = [
        book.title,
        book.subtitle,
        ...book.authors.map((a) => a.name),
        ...book.narrators.map((n) => n.name),
        ...book.series.map((s) => s.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return searchableText.includes(term)
    })
  }

  if (options.mediaFilter && options.mediaFilter !== "all") {
    result = result.filter((book) => {
      switch (options.mediaFilter) {
        case "ebook":
          return book.ebook !== null
        case "audiobook":
          return book.audiobook !== null
        case "synced":
          return book.readaloud?.status === "ALIGNED"
        default:
          return true
      }
    })
  }

  if (options.statusFilter) {
    const statusUuid = options.statusFilter
    result = result.filter((book) => book.status?.uuid === statusUuid)
  }

  const dir = options.sortDirection === "asc" ? 1 : -1
  const field = options.sortField ?? "createdAt"

  result = [...result].sort((a, b) => {
    switch (field) {
      case "title":
        return a.title.localeCompare(b.title) * dir
      case "publicationDate":
        return (
          (a.publicationDate ?? "").localeCompare(b.publicationDate ?? "") * dir
        )
      case "updatedAt":
        return a.updatedAt.localeCompare(b.updatedAt) * dir
      case "createdAt":
      default:
        return a.createdAt.localeCompare(b.createdAt) * dir
    }
  })

  return result
}
