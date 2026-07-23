import { GRADE_COLORS } from "@v3/_/components/books/grade-pill"

import { isWellKnownStatus } from "@/database/statusKinds"
import {
  FACET_SECTION_REGISTRY,
  type FacetSection,
  type FacetSectionDef,
} from "@/facet-sections"
import { type FormatValue } from "@/fields"
import { type ShelfFilterField, type ShelfFilterNode } from "@/shelves"
import { GRADE_RANK, type SortDirection, type SortField } from "@/sort"
import { type ListBooksQueryArg } from "@/store/api"

export const NONE_KEY = "__none__"
export const ALL_KEY = "__all__"

export type FacetValue = {
  key: string
  name: string
  bookCount: number
  // present for entities that carry an icon/color (tags, collections)
  icon?: string | null
  color?: string | null
  // kind for statuses and identifier types, to prevent editing built-in ones
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
  | "identifier"

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
  /* built-in facet values (core identifier kinds) that can't be edited,
  deleted, or merged away; they show a lock in the sidebar */
  isItemLocked?: (item: FacetValue) => boolean
  /* replaces the alphabetical "name" ordering in the sidebar when facet names
  have a domain order (grades sort by rank, not by text) */
  compareItems?: (a: FacetValue, b: FacetValue) => number
  /* when present, matching items are pinned to the top of the sidebar
  regardless of the active sort mode */
  pinItem?: (item: FacetValue) => boolean
  /* a signature colour per facet value, keyed by facet key (grades → their
  grade-pill colour). takes precedence over any entity colour. */
  itemColor?: (itemKey: string) => string | null | undefined
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
    qualifier: role,
  })
}

function emptyFilter(
  field: ShelfFilterField,
  qualifier?: string,
): ShelfFilterNode {
  return {
    type: "condition",
    field,
    operator: "isEmpty",
    ...(qualifier ? { qualifier } : {}),
  }
}

// the "(no X)" filter derives from the section's none binding in
// facet-sections.ts, the same binding the server's none count uses.
function sectionNoneFilter(section: FacetSection): ShelfFilterNode | undefined {
  const none: FacetSectionDef["none"] = FACET_SECTION_REGISTRY[section].none
  if (!none) return undefined
  return emptyFilter(none.field, none.qualifier)
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
    noneFilter: sectionNoneFilter("series"),
    entityType: "series" as const,
    sort: {
      field: "seriesPosition",
      direction: "asc",
    },
  },
  authors: {
    key: "authors" as const,
    toShelfFilter: creatorFilter("aut"),
    noneFilter: sectionNoneFilter("authors"),
    entityType: "creator" as const,
  },
  narrators: {
    key: "narrators" as const,
    toShelfFilter: creatorFilter("nrt"),
    noneFilter: sectionNoneFilter("narrators"),
    entityType: "creator" as const,
  },
  translators: {
    key: "translators" as const,
    toShelfFilter: creatorFilter("trl"),
    noneFilter: sectionNoneFilter("translators"),
    entityType: "creator" as const,
  },
  tags: {
    key: "tags" as const,
    toShelfFilter: entityFilter("tags"),
    noneFilter: sectionNoneFilter("tags"),
    entityType: "tag" as const,
  },
  collections: {
    key: "collections" as const,
    toShelfFilter: entityFilter("collections"),
    noneFilter: sectionNoneFilter("collections"),
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
    noneFilter: sectionNoneFilter("statuses"),
    pinItem: (item) => !!item.kind && isWellKnownStatus(item.kind),
  },
  // facet values are identifier types (isbn, asin, ...); picking one filters
  // to books carrying any identifier of that type
  identifiers: {
    key: "identifiers" as const,
    entityType: "identifier" as const,
    toShelfFilter: (itemKey: string): ShelfFilterNode => ({
      type: "condition",
      field: "identifiers",
      operator: "isNotEmpty",
      qualifier: itemKey,
    }),
    noneFilter: sectionNoneFilter("identifiers"),
    // core kinds (asin, isbn-13, ...) are code-defined; renaming or merging
    // them away would break scheme resolution on the next scan
    isItemLocked: (item) => !!item.kind,
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
    noneFilter: sectionNoneFilter("publicationYears"),
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
    noneFilter: sectionNoneFilter("ratings"),
  },
  formats: {
    key: "formats" as const,
    toShelfFilter: (itemKey: string): ShelfFilterNode => ({
      type: "condition",
      field: "format",
      operator: "is",
      value: itemKey as FormatValue,
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
    // highest grade (A+) first, worst (F) last; unknown grades sink to the end
    compareItems: (a, b) =>
      (GRADE_RANK[b.name] ?? -1) - (GRADE_RANK[a.name] ?? -1),
    itemColor: (key) => GRADE_COLORS[key] ?? null,
    sort: {
      field: "alignmentScore",
      direction: "desc",
    },
  },
  shelves: {
    key: "shelves" as const,
    entityType: "shelf" as const,
  },
} as const satisfies Record<FacetSection, LibrarySectionDef>

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
