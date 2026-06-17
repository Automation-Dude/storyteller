import { type BookWithRelations } from "@/database/books"
import {
  type SortContext,
  type SortDirection,
  type SortField,
  makeBookComparator,
} from "@/sort"
import { type MediaFilter } from "@/store/api"

export type ClientFilterOptions = {
  search?: string | undefined
  sortField?: SortField | undefined
  sortDirection?: SortDirection | undefined
  mediaFilter?: MediaFilter | undefined
  statusFilter?: string | null | undefined
  // resolves seriesPosition when sorting inside a series context
  sortContext?: SortContext | undefined
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

  const field = options.sortField ?? "createdAt"
  const direction = options.sortDirection ?? "desc"

  result = [...result].sort(
    makeBookComparator(field, direction, options.sortContext),
  )

  return result
}
