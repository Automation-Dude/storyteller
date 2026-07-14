import { useMemo, useState } from "react"

import { type BookWithRelations } from "@/database/books"

export type SortKey = "recent" | "title" | "author" | "series"

export const SORT_LABELS: Record<SortKey, string> = {
  recent: "Recently added",
  title: "Title",
  author: "Author",
  series: "Series",
}

export type BookFilters = {
  tag: string | null
  author: string | null
  series: string | null
}

export const EMPTY_FILTERS: BookFilters = {
  tag: null,
  author: null,
  series: null,
}

export type Facet = { name: string; count: number }

/**
 * Collect the facet values present in a set of books, most common first, so
 * the filter menus only ever offer choices that lead somewhere.
 */
function collectFacet(
  books: BookWithRelations[],
  pick: (book: BookWithRelations) => string[],
): Facet[] {
  const counts = new Map<string, number>()

  for (const book of books) {
    for (const value of pick(book)) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function firstSeriesPosition(book: BookWithRelations) {
  return book.series[0]?.position ?? Number.MAX_SAFE_INTEGER
}

const SORTS: Record<
  SortKey,
  (a: BookWithRelations, b: BookWithRelations) => number
> = {
  recent: (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  title: (a, b) => a.title.localeCompare(b.title),
  author: (a, b) =>
    (a.authors[0]?.name ?? "").localeCompare(b.authors[0]?.name ?? "") ||
    a.title.localeCompare(b.title),
  // Within a series, position is what a reader expects; books with no series
  // fall to the end rather than interleaving.
  series: (a, b) =>
    (a.series[0]?.name ?? "￿").localeCompare(b.series[0]?.name ?? "￿") ||
    firstSeriesPosition(a) - firstSeriesPosition(b) ||
    a.title.localeCompare(b.title),
}

export function useBookFilters(books: BookWithRelations[]) {
  const [filters, setFilters] = useState<BookFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortKey>("recent")

  const facets = useMemo(
    () => ({
      tags: collectFacet(books, (book) => book.tags.map((t) => t.name)),
      authors: collectFacet(books, (book) => book.authors.map((a) => a.name)),
      series: collectFacet(books, (book) => book.series.map((s) => s.name)),
    }),
    [books],
  )

  const filteredBooks = useMemo(() => {
    const filtered = books.filter(
      (book) =>
        (!filters.tag || book.tags.some((t) => t.name === filters.tag)) &&
        (!filters.author ||
          book.authors.some((a) => a.name === filters.author)) &&
        (!filters.series || book.series.some((s) => s.name === filters.series)),
    )

    return filtered.sort(SORTS[sort])
  }, [books, filters, sort])

  const activeCount = Object.values(filters).filter(Boolean).length

  return {
    filters,
    setFilters,
    sort,
    setSort,
    facets,
    filteredBooks,
    activeCount,
    clear: () => {
      setFilters(EMPTY_FILTERS)
    },
  }
}
