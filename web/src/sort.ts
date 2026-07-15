import { type BookWithRelations } from "@/database/books"
import { ALIGNMENT_GRADES, FIELD_REGISTRY } from "@/fields"
import { type ShelfFilterNode } from "@/shelves"
import { type UUID } from "@/uuid"

import { type AcceptedKeys } from "./app/(v3)/v3/_/lib/mapping"

// the registry-backed sortable fields. seriesPosition is a virtual,
// context-scoped sort field (series page / active series filter) that isn't in
// the registry, so it's unioned in separately below.
export type RegistrySortField = AcceptedKeys<
  typeof FIELD_REGISTRY,
  { sortable: true }
>
export type SortField = RegistrySortField | "seriesPosition"

export const SORTABLE_FIELDS = Object.entries(FIELD_REGISTRY)
  .filter(([_f, p]) => p.sortable)
  .map(([f]) => f) as RegistrySortField[]

export const GRADE_RANK: Record<string, number> = Object.fromEntries(
  ALIGNMENT_GRADES.map((grade, i) => [grade, ALIGNMENT_GRADES.length - i]),
)

export type SortDirection = "asc" | "desc"
export type BookSort = { field: SortField; direction: SortDirection }[]

// seriesPosition is only meaningful inside a series context (series page or an
// active series filter) and isn't registry-backed, so SORTABLE_FIELDS (registry
// only) is already the general-purpose set.
export const GENERAL_SORT_FIELDS: RegistrySortField[] = SORTABLE_FIELDS

export type SortContext = { seriesUuid?: UUID | null }

// the card's secondary line can show any sortable field, or one of the
// display-only creator rows (authors is the historical default; narrators /
// translators / other creators are shown but never sorted by).
export type CreatorDisplayField =
  | "authors"
  | "narrators"
  | "translators"
  | "creators"
export const CREATOR_DISPLAY_FIELDS: readonly CreatorDisplayField[] = [
  "narrators",
  "translators",
  "creators",
]

export type DisplayField = SortField | CreatorDisplayField

export const DISPLAY_FIELDS = [
  ...SORTABLE_FIELDS,
  ...CREATOR_DISPLAY_FIELDS,
] as const

const NEUTRAL_DISPLAY_FIELDS: readonly SortField[] = [
  "createdAt",
  "updatedAt",
  "title",
  "language",
]

// the auto-mode secondary field: echo an explicitly chosen sort, else (still on
// the default sort) a filtered field, else series position or the authors.
// title is added on top by the caller.
function deriveAutoSecondary(
  sortField: SortField,
  isDefaultSort: boolean,
  filter?: ShelfFilterNode,
  ctx?: SortContext,
): DisplayField {
  // a sort the user actually picked always echoes itself, so a filter can never
  // take over the display slot. the untouched default sort only echoes itself
  // when it's a meaningful (non-neutral) field.
  if (sortField !== "title") {
    if (!isDefaultSort) return sortField
    if (!NEUTRAL_DISPLAY_FIELDS.includes(sortField)) return sortField
  }
  if (filter?.type === "condition") {
    if ((DISPLAY_FIELDS as readonly string[]).includes(filter.field)) {
      return filter.field as DisplayField
    }
  }

  // otherwise a series context still surfaces position over the authors
  if (ctx?.seriesUuid) return "seriesPosition"
  return "authors"
}

export function deriveDisplayFields(
  sortField: SortField,
  filter?: ShelfFilterNode,
  ctx?: SortContext,
  overrides?: DisplayField[] | null,
  // whether the current sort is still the page default (not chosen by the user)
  isDefaultSort = true,
): DisplayField[] {
  // an explicit selection (including an empty set = show nothing) wins verbatim.
  if (overrides) return overrides

  // auto mode: the derived secondary field above the title (the card's heading
  // sits at the bottom), matching the historical single-field layout.
  const secondary = deriveAutoSecondary(sortField, isDefaultSort, filter, ctx)
  return secondary === "title" ? ["title"] : [secondary, "title"]
}

// fields short enough to share a card row (joined with a separator). title and
// the creator rows always get their own line.
const COMPACT_DISPLAY_FIELDS: ReadonlySet<DisplayField> = new Set([
  "pageCount",
  "duration",
  "fileSize",
  "publicationDate",
  "userRating",
  "alignmentScore",
  "alignmentGrade",
  "alignmentMissingSentences",
  "alignmentMutedChapters",
  "alignmentMissingChapters",
])

const MAX_COMPACT_PER_ROW = 2

// group the selected display fields into the rows a card renders: consecutive
// compact fields pair up (max two per row), everything else is its own row.
export function groupDisplayRows(fields: DisplayField[]): DisplayField[][] {
  const rows: DisplayField[][] = []
  for (const field of fields) {
    const last = rows[rows.length - 1]
    if (
      last &&
      COMPACT_DISPLAY_FIELDS.has(field) &&
      last.length < MAX_COMPACT_PER_ROW &&
      last.every((f) => COMPACT_DISPLAY_FIELDS.has(f))
    ) {
      last.push(field)
    } else {
      rows.push([field])
    }
  }
  return rows
}

// insert a newly toggled-on field above the title row (extra fields stack above
// the card heading, never below it).
export function insertDisplayField(
  fields: DisplayField[],
  field: DisplayField,
): DisplayField[] {
  const titleIndex = fields.indexOf("title")
  if (titleIndex === -1) return [...fields, field]
  return [...fields.slice(0, titleIndex), field, ...fields.slice(titleIndex)]
}

function seriesPositionOf(
  book: BookWithRelations,
  ctx: SortContext | undefined,
): number | null {
  if (!ctx?.seriesUuid) return null
  return book.series.find((s) => s.uuid === ctx.seriesUuid)?.position ?? null
}

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
      return book.userBookRating?.rating ?? null
    case "pageCount":
      return book.ebook?.pageCount ?? book.pageCount
    case "duration":
      return book.audiobook?.duration ?? book.duration
    case "fileSize":
      return book.ebook?.fileSize ?? book.audiobook?.fileSize ?? null
    case "authors":
      return book.authors.map((a) => a.name).join(", ")
    case "alignmentScore":
      return book.alignmentSummary?.score ?? null
    case "alignmentGrade":
      return book.alignmentSummary?.grade
        ? GRADE_RANK[book.alignmentSummary.grade] ?? null
        : null
    case "alignmentMissingSentences":
      return book.alignmentSummary?.missingSentences ?? null
    case "alignmentMutedChapters":
      return book.alignmentSummary?.mutedChapters ?? null
    case "alignmentMissingChapters":
      // no client-side data source (not selected into alignmentSummary), so it
      // can't participate in client-side comparison; server sort still applies.
      return null
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
