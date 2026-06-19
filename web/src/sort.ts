// shared sort vocabulary for book lists. server (getBooks / buildSortExpression)
// and client (filterBooksClientSide) both import this so the set of sortable
// fields and the ordering semantics stay in one place. SortField is a subset of
// the filterable field vocabulary in shelves.ts plus the context-only
// seriesPosition.

import { type BookWithRelations } from "@/database/books"
import { FIELD_LABELS } from "@/shelves"
import { type UUID } from "@/uuid"

export const SORTABLE_FIELDS = [
  "title",
  "createdAt",
  "updatedAt",
  "publicationDate",
  "userRating",
  "pageCount",
  "duration",
  "fileSize",
  "language",
  "seriesPosition",
] as const

export type SortField = (typeof SORTABLE_FIELDS)[number]
export type SortDirection = "asc" | "desc"
export type BookSort = { field: SortField; direction: SortDirection }[]

// seriesPosition is only meaningful inside a series context (series page or an
// active series filter); everything else is a general-purpose sort.
export const GENERAL_SORT_FIELDS = SORTABLE_FIELDS.filter(
  (f) => f !== "seriesPosition",
)

export const SORT_FIELD_LABELS: Record<SortField, string> = {
  title: FIELD_LABELS.title,
  createdAt: FIELD_LABELS.createdAt,
  updatedAt: FIELD_LABELS.updatedAt,
  publicationDate: FIELD_LABELS.publicationDate,
  userRating: FIELD_LABELS.userRating,
  pageCount: FIELD_LABELS.pageCount,
  duration: FIELD_LABELS.duration,
  fileSize: FIELD_LABELS.fileSize,
  language: FIELD_LABELS.language,
  seriesPosition: "Series Position",
}

export type SortContext = { seriesUuid?: UUID | null }

// the card's secondary line can show any sortable field, or fall back to the
// authors (the historical default).
export type DisplayField = SortField | "authors"

export const DISPLAY_FIELDS = [...SORTABLE_FIELDS, "authors"] as const

export const DISPLAY_FIELD_LABELS: Record<DisplayField, string> = {
  ...SORT_FIELD_LABELS,
  authors: "Author",
}

// fields whose value is already the title line or carries no useful secondary
// signal -> keep showing authors rather than echoing the sort.
const NEUTRAL_DISPLAY_FIELDS: readonly SortField[] = [
  "createdAt",
  "updatedAt",
  "title",
  "language",
]

// what each card should show in its secondary line: an explicit override wins,
// otherwise a series context shows position, a meaningful sort echoes itself,
// and everything else falls back to authors.
export function deriveDisplayField(
  sortField: SortField,
  ctx?: SortContext,
  override?: DisplayField | null,
): DisplayField {
  if (override) return override
  // an explicit, meaningful sort echoes itself (show what you sorted by)
  if (!NEUTRAL_DISPLAY_FIELDS.includes(sortField)) return sortField
  // otherwise a series context still surfaces position over the authors
  if (ctx?.seriesUuid) return "seriesPosition"
  return "authors"
}

function seriesPositionOf(
  book: BookWithRelations,
  ctx: SortContext | undefined,
): number | null {
  if (!ctx?.seriesUuid) return null
  return book.series.find((s) => s.uuid === ctx.seriesUuid)?.position ?? null
}

// the raw comparable value for a field. strings sort lexically, numbers
// numerically; null means "no value" and is always sorted last (see compare).
function sortValue(
  book: BookWithRelations,
  field: SortField,
  ctx: SortContext | undefined,
): string | number | null {
  switch (field) {
    case "title":
      return book.title
    case "language":
      return book.language
    case "createdAt":
      return book.createdAt
    case "updatedAt":
      return book.updatedAt
    case "publicationDate":
      return book.publicationDate
    case "userRating":
      return book.rating?.rating ?? null
    case "pageCount":
      return book.ebook?.pageCount ?? book.pageCount
    case "duration":
      return book.audiobook?.duration ?? book.duration
    case "fileSize":
      return book.ebook?.fileSize ?? book.audiobook?.fileSize ?? null
    case "seriesPosition":
      return seriesPositionOf(book, ctx)
  }
}

export function makeBookComparator(
  field: SortField,
  direction: SortDirection,
  ctx?: SortContext,
): (a: BookWithRelations, b: BookWithRelations) => number {
  const dir = direction === "asc" ? 1 : -1
  return (a, b) => {
    const av = sortValue(a, field, ctx)
    const bv = sortValue(b, field, ctx)

    // nulls always sort last, regardless of direction
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1

    if (typeof av === "string" && typeof bv === "string") {
      return av.localeCompare(bv) * dir
    }
    return (Number(av) - Number(bv)) * dir
  }
}
