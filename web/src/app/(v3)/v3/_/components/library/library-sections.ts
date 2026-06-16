import { type BookWithRelations } from "@/database/books"
import { type ShelfFilterNode } from "@/shelves"

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
  extractItems: (books: BookWithRelations[]) => LibraryItem[]
  filterBooks: (
    books: BookWithRelations[],
    itemKey: string,
  ) => BookWithRelations[]
  // build a shelf filter matching a single facet, for "pin as shelf". absent
  // when the facet can't be expressed as a saved filter (e.g. publication year).
  toShelfFilter?: (itemKey: string) => ShelfFilterNode
  // when present, the sidebar supports edit/delete/merge for this entity type
  entityType?: LibraryEntityType
  // returns books that have none of this entity (no author, no tag, etc.)
  filterNone?: (books: BookWithRelations[]) => BookWithRelations[]
}

// an entity facet (author/series/tag/...) maps to an array-field "includes" of
// that entity's uuid.
function entityFilter(
  field: "tags" | "collections" | "series" | "creators",
): (itemKey: string) => ShelfFilterNode {
  return (itemKey) => ({
    type: "condition",
    field,
    operator: "includes",
    value: [itemKey],
  })
}

function buildRelationSection<
  T extends {
    uuid: string
    name: string
    fileAs?: string
    icon?: string | null
    color?: string | null
  },
>(getRelations: (book: BookWithRelations) => T[]): LibrarySectionDef {
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
): LibrarySectionDef {
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

export const librarySections = {
  series: {
    ...buildRelationSection((book) => book.series),
    toShelfFilter: entityFilter("series"),
    entityType: "series" as const,
  },
  authors: {
    ...buildRelationSection((book) => book.authors),
    toShelfFilter: entityFilter("creators"),
    entityType: "creator" as const,
  },
  narrators: {
    ...buildRelationSection((book) => book.narrators),
    toShelfFilter: entityFilter("creators"),
    entityType: "creator" as const,
  },
  translators: {
    ...buildRelationSection((book) =>
      book.creators.filter((c) => c.role === "trl"),
    ),
    toShelfFilter: entityFilter("creators"),
    entityType: "creator" as const,
  },
  tags: {
    ...buildRelationSection((book) => book.tags),
    toShelfFilter: entityFilter("tags"),
    entityType: "tag" as const,
  },
  collections: {
    ...buildRelationSection((book) => book.collections),
    toShelfFilter: entityFilter("collections"),
    entityType: "collection" as const,
  },
  statuses: {
    ...buildRelationSection((book) => (book.status ? [book.status] : [])),
    toShelfFilter: (itemKey: string): ShelfFilterNode => ({
      type: "condition",
      field: "status",
      operator: "is",
      value: itemKey,
    }),
  },
  publicationYears: buildScalarSection((book) =>
    book.publicationDate?.slice(0, 4),
  ),
  ratings: {
    ...buildScalarSection((book) =>
      book.rating != null ? String(book.rating.rating) : null,
    ),
    toShelfFilter: (itemKey: string): ShelfFilterNode => ({
      type: "condition",
      field: "rating",
      operator: "is",
      value: Number(itemKey),
    }),
  },
  formats: {
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
