import { type BookWithRelations } from "@/database/books"

export type LibraryItem = {
  key: string
  name: string
  bookCount: number
}

export type LibrarySectionDef = {
  extractItems: (books: BookWithRelations[]) => LibraryItem[]
  filterBooks: (
    books: BookWithRelations[],
    itemKey: string,
  ) => BookWithRelations[]
}

function buildRelationSection<
  T extends { uuid: string; name: string; fileAs?: string },
>(getRelations: (book: BookWithRelations) => T[]): LibrarySectionDef {
  return {
    extractItems(books) {
      const map = new Map<string, { name: string; count: number }>()

      for (const book of books) {
        for (const rel of getRelations(book)) {
          const existing = map.get(rel.uuid)

          if (existing) {
            existing.count += 1
          } else {
            map.set(rel.uuid, {
              name: rel.fileAs ?? rel.name,
              count: 1,
            })
          }
        }
      }

      return Array.from(map, ([key, { name, count }]) => ({
        key,
        name,
        bookCount: count,
      }))
    },

    filterBooks(books, itemKey) {
      return books.filter((book) =>
        getRelations(book).some((rel) => rel.uuid === itemKey),
      )
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
      return books.filter((book) => getValue(book) === itemKey)
    },
  }
}

export const librarySections = {
  series: buildRelationSection((book) => book.series),
  authors: buildRelationSection((book) => book.authors),
  narrators: buildRelationSection((book) => book.narrators),
  translators: buildRelationSection((book) =>
    book.creators.filter((c) => c.role === "trl"),
  ),
  tags: buildRelationSection((book) => book.tags),
  statuses: buildRelationSection((book) => (book.status ? [book.status] : [])),
  publicationYears: buildScalarSection((book) =>
    book.publicationDate?.slice(0, 4),
  ),
  ratings: buildScalarSection((book) =>
    book.rating != null ? String(book.rating.rating) : null,
  ),
} as const satisfies Record<string, LibrarySectionDef>

export type LibrarySectionKey = keyof typeof librarySections
