import { type FacetSection } from "@/database/libraryCounts"
import { ALIGNMENT_GRADES, type MediaTypeValue } from "@/fields"
import { type ShelfFilterField, type ShelfFilterNode } from "@/shelves"
import { GRADE_RANK, type SortDirection, type SortField } from "@/sort"
import { type ListBooksQueryArg } from "@/store/api"

export const NONE_KEY = "__none__"
export const ALL_KEY = "__all__"

export type LibraryItem = {
  key: string
  name: string
  bookCount: number
  // present for entities that carry an icon/color (tags, collections)
  icon?: string | null
  color?: string | null
  // kind for statues, to prevent editing
  kind?: string
}

// status and shelf no edit or merge
export type LibraryEntityType =
  | "tag"
  | "creator"
  | "series"
  | "collection"
  | "status"
  | "shelf"

export type LibrarySectionDef = {
  /* the section identifier, used to fetch its facet list from the server. */
  key: FacetSection
  /* build a shelf filter matching a single facet, for "pin as shelf". absent
  when the facet can't be expressed as a saved filter (e.g. publication year). */
  toShelfFilter?: (itemKey: string) => ShelfFilterNode
  /* the filter seeding the "(no author)" / "(no series)" bucket's grid. absent
  for sections that have no none bucket (formats, grades). */
  noneFilter?: ShelfFilterNode
  /* the filter behind a synthetic "all" row pinned at the top of the sidebar,
  for sections whose facets don't span the whole library (grades → "All graded") */
  allFilter?: ShelfFilterNode
  /* when present, the sidebar supports edit/delete/merge for this entity type */
  entityType?: LibraryEntityType
  /* replaces the alphabetical "name" ordering in the sidebar when facet names
  have a domain order (grades sort by rank, not by text) */
  compareItems?: (a: LibraryItem, b: LibraryItem) => number
  sort?: {
    field: SortField
    direction: SortDirection
  }
}

function entityFilter(
  field: "tags" | "collections" | "series",
): (itemKey: string) => ShelfFilterNode {
  return (itemKey) => ({
    type: "condition",
    field,
    operator: "includes",
    value: [itemKey],
  })
}

function creatorFilter(role: string): (itemKey: string) => ShelfFilterNode {
  return (itemKey) => ({
    type: "condition",
    field: "creators",
    operator: "includes",
    value: [itemKey],
    role,
  })
}

// the "(no X)" seed: an isEmpty test on the section's field (role-scoped for
// creators so "(no narrator)" means no narrator, not no creator at all).
function emptyFilter(field: ShelfFilterField, role?: string): ShelfFilterNode {
  return {
    type: "condition",
    field,
    operator: "isEmpty",
    ...(role ? { role } : {}),
  }
}

// the format facet keys map onto the broader Format filter values so a
// formats-page facet can seed the same server filter as the books page.
// "readaloud" -> synced (aligned), "audiobook-ebook" -> missing-readaloud.
// typed to MediaTypeValue so a facet can only seed a filter value the enum (and
// therefore the SQL compiler) actually supports - an invalid bridge is a compile
// error, not a filter that silently matches nothing.
const FORMAT_KEY_TO_MEDIA_TYPE: Record<FormatKey, MediaTypeValue> = {
  readaloud: "synced",
  "audiobook-ebook": "missing-readaloud",
  "audiobook-only": "audiobook-only",
  "ebook-only": "ebook-only",
  "no-media": "no-media",
}

const GRADED_FILTER: ShelfFilterNode = {
  type: "condition",
  field: "alignmentGrade",
  operator: "isNotEmpty",
}

export const librarySections = {
  series: {
    key: "series" as const,
    toShelfFilter: entityFilter("series"),
    noneFilter: emptyFilter("series"),
    entityType: "series" as const,
    sort: {
      field: "seriesPosition",
      direction: "asc",
    },
  },
  authors: {
    key: "authors" as const,
    toShelfFilter: creatorFilter("aut"),
    noneFilter: emptyFilter("creators", "aut"),
    entityType: "creator" as const,
  },
  narrators: {
    key: "narrators" as const,
    toShelfFilter: creatorFilter("nrt"),
    noneFilter: emptyFilter("creators", "nrt"),
    entityType: "creator" as const,
  },
  translators: {
    key: "translators" as const,
    toShelfFilter: creatorFilter("trl"),
    noneFilter: emptyFilter("creators", "trl"),
    entityType: "creator" as const,
  },
  tags: {
    key: "tags" as const,
    toShelfFilter: entityFilter("tags"),
    noneFilter: emptyFilter("tags"),
    entityType: "tag" as const,
  },
  collections: {
    key: "collections" as const,
    toShelfFilter: entityFilter("collections"),
    noneFilter: emptyFilter("collections"),
    entityType: "collection" as const,
  },
  statuses: {
    key: "statuses" as const,
    entityType: "status" as const,
    toShelfFilter: (itemKey: string): ShelfFilterNode => ({
      type: "condition",
      field: "status",
      operator: "is",
      value: itemKey,
    }),
    noneFilter: emptyFilter("status"),
  },
  publicationYears: {
    key: "publicationYears" as const,
    // a year facet seeds a date range. the lower bound is the bare year (not
    // year-01-01) so it also matches books whose date is stored as "YYYY".
    toShelfFilter: (itemKey: string): ShelfFilterNode => ({
      type: "condition",
      field: "publicationDate",
      operator: "between",
      value: [itemKey, `${itemKey}-12-31`],
    }),
    noneFilter: emptyFilter("publicationDate"),
  },
  ratings: {
    key: "ratings" as const,
    toShelfFilter: (itemKey: string): ShelfFilterNode => {
      const [min = 0, max = 5] = itemKey.split("-").map(Number)

      return {
        type: "condition",
        field: "userRating",
        operator: "between",
        value: [min, max],
      }
    },
    sort: {
      field: "userRating",
      direction: "desc",
    },
    noneFilter: emptyFilter("userRating"),
  },
  formats: {
    key: "formats" as const,
    toShelfFilter: (itemKey: string): ShelfFilterNode => ({
      type: "condition",
      field: "mediaType",
      operator: "is",
      value: FORMAT_KEY_TO_MEDIA_TYPE[itemKey as FormatKey],
    }),
  },
  grades: {
    key: "grades" as const,
    toShelfFilter: (itemKey: string): ShelfFilterNode =>
      itemKey === ALL_KEY
        ? GRADED_FILTER
        : {
            type: "condition",
            field: "alignmentGrade",
            operator: "is",
            value: itemKey,
          },
    allFilter: GRADED_FILTER,
    compareItems: (a, b) =>
      (GRADE_RANK[a.name] ?? ALIGNMENT_GRADES.length) -
      (GRADE_RANK[b.name] ?? ALIGNMENT_GRADES.length),
    sort: {
      field: "alignmentScore",
      direction: "desc",
    },
  },
  shelves: {
    key: "shelves" as const,
    entityType: "shelf" as const,
  },
} as const satisfies Record<string, LibrarySectionDef>

export type LibrarySectionKey = keyof typeof librarySections

// translate a selected facet into the server query that constrains the grid to
// it. series and collections route through the native params so getBooks can
// supply series-position context and reuse its existing membership filters;
// everything else (and every "(no X)" / "all" bucket) seeds the generic
// filter tree.
export function sectionSeedQueryArg(
  section: LibrarySectionDef,
  itemKey: string,
): ListBooksQueryArg {
  if (itemKey === NONE_KEY) {
    return section.noneFilter ? { filter: section.noneFilter } : {}
  }

  if (itemKey === ALL_KEY) {
    return section.allFilter ? { filter: section.allFilter } : {}
  }

  if (section.entityType === "series") return { series: itemKey }
  if (section.entityType === "collection") return { collection: itemKey }

  return section.toShelfFilter ? { filter: section.toShelfFilter(itemKey) } : {}
}

// the exclusive format partition (every book falls in exactly one bucket),
// distinct from the overlapping MEDIA_TYPE_VALUES predicates. formatKeyExpr
// (SQL, libraryCounts.ts) computes these buckets; the union keeps the
// FORMAT_KEY_TO_MEDIA_TYPE bridge in lockstep with it.
export type FormatKey =
  | "readaloud"
  | "audiobook-ebook"
  | "audiobook-only"
  | "ebook-only"
  | "no-media"
