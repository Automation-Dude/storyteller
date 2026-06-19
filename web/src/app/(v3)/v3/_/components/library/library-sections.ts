import { type BookWithRelations } from "@/database/books"
import { type FacetSection } from "@/database/libraryCounts"
import { type ShelfFilterField, type ShelfFilterNode } from "@/shelves"
import { type ListBooksQueryArg } from "@/store/api"

// mirrors NONE_FACET_KEY in libraryCounts.ts (kept as a separate literal so this
// client module doesn't pull in the server db module).
export const NONE_KEY = "__none__"

export type LibraryItem = {
  key: string
  name: string
  bookCount: number
  // present for entities that carry an icon/color (tags, collections)
  icon?: string | null
  color?: string | null
}

// entity types that support edit/delete/merge from the sidebar
export type LibraryEntityType = "tag" | "creator" | "series" | "collection"

export type LibrarySectionDef = {
  // the section identifier, used to fetch its facet list from the server.
  key: FacetSection
  extractItems: (books: BookWithRelations[]) => LibraryItem[]
  filterBooks: (
    books: BookWithRelations[],
    itemKey: string,
  ) => BookWithRelations[]
  // build a shelf filter matching a single facet, for "pin as shelf". absent
  // when the facet can't be expressed as a saved filter (e.g. publication year).
  toShelfFilter?: (itemKey: string) => ShelfFilterNode
  // the filter seeding the "(no author)" / "(no series)" bucket's grid. absent
  // for sections that have no none bucket (formats).
  noneFilter?: ShelfFilterNode
  // when present, the sidebar supports edit/delete/merge for this entity type
  entityType?: LibraryEntityType
  // returns books that have none of this entity (no author, no tag, etc.)
  filterNone?: (books: BookWithRelations[]) => BookWithRelations[]
}

// an entity facet (series/tag/collection) maps to an array-field "includes" of
// that entity's uuid.
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

// a creator facet, scoped to a single relator role so the narrators page filters
// on narration (not "anyone who is also an author").
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

function buildRelationSection<
  T extends {
    uuid: string
    name: string
    fileAs?: string
    icon?: string | null
    color?: string | null
  },
>(getRelations: (book: BookWithRelations) => T[]): Omit<
  LibrarySectionDef,
  "key"
> {
  return {
    extractItems(books) {
      const map = new Map<
        string,
        { name: string; count: number; icon: string | null; color: string | null }
      >()

      for (const book of books) {
        for (const rel of getRelations(book)) {
          const existing = map.get(rel.uuid)

          if (existing) {
            existing.count += 1
          } else {
            map.set(rel.uuid, {
              name: rel.fileAs ?? rel.name,
              count: 1,
              icon: rel.icon ?? null,
              color: rel.color ?? null,
            })
          }
        }
      }

      return Array.from(map, ([key, { name, count, icon, color }]) => ({
        key,
        name,
        bookCount: count,
        icon,
        color,
      }))
    },

    filterBooks(books, itemKey) {
      if (itemKey === NONE_KEY) {
        return books.filter((book) => getRelations(book).length === 0)
      }

      return books.filter((book) =>
        getRelations(book).some((rel) => rel.uuid === itemKey),
      )
    },

    filterNone(books) {
      return books.filter((book) => getRelations(book).length === 0)
    },
  }
}

function buildScalarSection(
  getValue: (book: BookWithRelations) => string | null | undefined,
): Omit<LibrarySectionDef, "key"> {
  return {
    extractItems(books) {
      const map = new Map<string, number>()

      for (const book of books) {
        const value = getValue(book)
        if (!value) continue

        map.set(value, (map.get(value) ?? 0) + 1)
      }

      return Array.from(map, ([key, count]) => ({
        key,
        name: key,
        bookCount: count,
      }))
    },

    filterBooks(books, itemKey) {
      if (itemKey === NONE_KEY) {
        return books.filter((book) => !getValue(book))
      }

      return books.filter((book) => getValue(book) === itemKey)
    },

    filterNone(books) {
      return books.filter((book) => !getValue(book))
    },
  }
}

// the format facet keys (getFormatKey) map onto the broader Format filter
// values so a formats-page facet can seed the same server filter as the books
// page. "readaloud" -> synced (aligned), "audiobook-ebook" -> missing-readaloud.
const FORMAT_KEY_TO_MEDIA_TYPE: Record<FormatKey, string> = {
  readaloud: "synced",
  "audiobook-ebook": "missing-readaloud",
  "audiobook-only": "audiobook-only",
  "ebook-only": "ebook-only",
  "no-media": "no-media",
}

export const librarySections = {
  series: {
    key: "series" as const,
    ...buildRelationSection((book) => book.series),
    toShelfFilter: entityFilter("series"),
    noneFilter: emptyFilter("series"),
    entityType: "series" as const,
  },
  authors: {
    key: "authors" as const,
    ...buildRelationSection((book) => book.authors),
    toShelfFilter: creatorFilter("aut"),
    noneFilter: emptyFilter("creators", "aut"),
    entityType: "creator" as const,
  },
  narrators: {
    key: "narrators" as const,
    ...buildRelationSection((book) => book.narrators),
    toShelfFilter: creatorFilter("nrt"),
    noneFilter: emptyFilter("creators", "nrt"),
    entityType: "creator" as const,
  },
  translators: {
    key: "translators" as const,
    ...buildRelationSection((book) =>
      book.creators.filter((c) => c.role === "trl"),
    ),
    toShelfFilter: creatorFilter("trl"),
    noneFilter: emptyFilter("creators", "trl"),
    entityType: "creator" as const,
  },
  tags: {
    key: "tags" as const,
    ...buildRelationSection((book) => book.tags),
    toShelfFilter: entityFilter("tags"),
    noneFilter: emptyFilter("tags"),
    entityType: "tag" as const,
  },
  collections: {
    key: "collections" as const,
    ...buildRelationSection((book) => book.collections),
    toShelfFilter: entityFilter("collections"),
    noneFilter: emptyFilter("collections"),
    entityType: "collection" as const,
  },
  statuses: {
    key: "statuses" as const,
    ...buildRelationSection((book) => (book.status ? [book.status] : [])),
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
    ...buildScalarSection((book) => book.publicationDate?.slice(0, 4)),
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
    ...buildScalarSection((book) =>
      book.rating != null ? String(book.rating.rating) : null,
    ),
    toShelfFilter: (itemKey: string): ShelfFilterNode => ({
      type: "condition",
      field: "userRating",
      operator: "is",
      value: Number(itemKey),
    }),
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
    extractItems(books) {
      const counts = new Map<string, number>()

      for (const book of books) {
        const key = getFormatKey(book)
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }

      return FORMAT_ORDER.filter((key) => (counts.get(key) ?? 0) > 0).map(
        (key) => ({
          key,
          name: key,
          bookCount: counts.get(key) ?? 0,
        }),
      )
    },

    filterBooks(books, itemKey) {
      return books.filter((book) => getFormatKey(book) === itemKey)
    },
  },
} as const satisfies Record<string, LibrarySectionDef>

export type LibrarySectionKey = keyof typeof librarySections

// translate a selected facet into the server query that constrains the grid to
// it. series and collections route through the native params so getBooks can
// supply series-position context and reuse its existing membership filters;
// everything else (and every "(no X)" bucket) seeds the generic filter tree.
export function sectionSeedQueryArg(
  section: LibrarySectionDef,
  itemKey: string,
): ListBooksQueryArg {
  if (itemKey === NONE_KEY) {
    return section.noneFilter ? { filter: section.noneFilter } : {}
  }

  if (section.entityType === "series") return { series: itemKey }
  if (section.entityType === "collection") return { collection: itemKey }

  return section.toShelfFilter ? { filter: section.toShelfFilter(itemKey) } : {}
}

type FormatKey =
  | "readaloud"
  | "audiobook-ebook"
  | "audiobook-only"
  | "ebook-only"
  | "no-media"

const FORMAT_ORDER: FormatKey[] = [
  "readaloud",
  "audiobook-ebook",
  "audiobook-only",
  "ebook-only",
  "no-media",
]

function getFormatKey(book: BookWithRelations): FormatKey {
  if (book.readaloud) return "readaloud"
  if (book.audiobook && book.ebook) return "audiobook-ebook"
  if (book.audiobook) return "audiobook-only"
  if (book.ebook) return "ebook-only"

  return "no-media"
}
