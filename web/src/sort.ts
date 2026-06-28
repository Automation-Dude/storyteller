// shared sort vocabulary for book lists. server (getBooks / buildSortExpression)
// and client (filterBooksClientSide) both import this so the set of sortable
// fields and the ordering semantics stay in one place. SortField is a subset of
// the filterable field vocabulary in shelves.ts plus the context-only
// seriesPosition.

import { type BookWithRelations } from "@/database/books"
import { registrySortableFields } from "@/shelves"
import { type UUID } from "@/uuid"

// kept as an explicit tuple (not derived) so SortField stays a narrow literal
// union the sort switches below + buildSortExpression can exhaustively cover.
// the field registry in shelves.ts is the conceptual source of truth; the
// assertSortFieldsMatchRegistry guard (run in tests) keeps the two in sync.
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
  "alignedAt",
  "lastRead",
  "alignmentScore",
  "alignmentGrade",
  "alignmentMissingSentences",
  "alignmentMutedChapters",
  "seriesPosition",
] as const

// fails fast if a field's `sortable` flag in FIELD_REGISTRY drifts from the
// tuple above (seriesPosition is the one allowed extra - it is not a filter
// field). called from the unit tests.
export function assertSortFieldsMatchRegistry(): void {
  const fromTuple = new Set<string>(
    SORTABLE_FIELDS.filter((f) => f !== "seriesPosition"),
  )
  const fromRegistry = new Set<string>(registrySortableFields())
  const missing = [...fromRegistry].filter((f) => !fromTuple.has(f))
  const extra = [...fromTuple].filter((f) => !fromRegistry.has(f))
  if (missing.length || extra.length) {
    throw new Error(
      `SORTABLE_FIELDS out of sync with FIELD_REGISTRY: missing [${missing.join(", ")}] extra [${extra.join(", ")}]`,
    )
  }
}

// best-to-worst rank so a descending sort surfaces the strongest alignments
// first, consistent with score. mirrors the analyzer's grade order.
export const GRADE_RANK: Record<string, number> = {
  "A+": 8,
  A: 7,
  "A-": 6,
  B: 5,
  "B-": 4,
  C: 3,
  D: 2,
  F: 1,
}

export type SortField = (typeof SORTABLE_FIELDS)[number]
export type SortDirection = "asc" | "desc"
export type BookSort = { field: SortField; direction: SortDirection }[]

// seriesPosition is only meaningful inside a series context (series page or an
// active series filter); everything else is a general-purpose sort.
export const GENERAL_SORT_FIELDS = SORTABLE_FIELDS.filter(
  (f) => f !== "seriesPosition",
)

export type SortContext = { seriesUuid?: UUID | null }

// the card's secondary line can show any sortable field, or fall back to the
// authors (the historical default).
export type DisplayField = SortField | "authors"

export const DISPLAY_FIELDS = [...SORTABLE_FIELDS, "authors"] as const

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
export function deriveDisplayFields(
  sortField: SortField,
  ctx?: SortContext,
  overrides?: DisplayField[] | null,
): DisplayField[] {
  if (overrides) return overrides
  // an explicit, meaningful sort echoes itself (show what you sorted by)
  if (!NEUTRAL_DISPLAY_FIELDS.includes(sortField)) return [sortField]
  // otherwise a series context still surfaces position over the authors
  if (ctx?.seriesUuid) return ["seriesPosition"]
  return ["authors"]
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
    case "alignmentScore":
      return book.alignmentScore
    case "alignmentGrade":
      return book.alignmentGrade
        ? GRADE_RANK[book.alignmentGrade] ?? null
        : null
    case "alignmentMissingSentences":
      return book.alignmentMissingSentences
    case "alignmentMutedChapters":
      return book.alignmentMutedChapters
    case "alignedAt":
      return book.alignedAt
    case "lastRead":
      return book.position?.updatedAt ?? null
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
