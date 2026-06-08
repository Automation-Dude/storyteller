import { sql } from "kysely"

import { type Role } from "@/components/books/edit/marcRelators"
import { type UUID } from "@/uuid"

import { db } from "./connection"
import { type ShelfFilter, buildFilterExpression } from "./shelfFilter"

// counts that back the library sidebar badges. computed entirely in SQL so the
// client never has to fetch full entity lists (or every book) just to count.
export type LibraryCounts = {
  series: number
  authors: number
  narrators: number
  translators: number
  tags: number
  statuses: number
  publicationYears: number
  ratings: number
  // book counts per collection / shelf, keyed by the entity uuid.
  collections: Record<string, number>
  shelves: Record<string, number>
}

// the set of books a user may see: their own listed collections, public
// collections, or books in no collection. mirrors the visibility clause in
// booksQuery / the entity getters so the counts match the lists they badge.
function visibleBooks(userId: UUID) {
  return db
    .selectFrom("book")
    .leftJoin("bookToCollection", "bookToCollection.bookUuid", "book.uuid")
    .leftJoin(
      "collection",
      "collection.uuid",
      "bookToCollection.collectionUuid",
    )
    .leftJoin(
      "collectionToUser",
      "collectionToUser.collectionUuid",
      "bookToCollection.collectionUuid",
    )
    .where((eb) =>
      eb.or([
        eb("collectionToUser.userId", "=", userId),
        eb("collection.public", "=", true),
        eb("collection.public", "is", null),
      ]),
    )
}

async function countCreatorsByRole(userId: UUID, role: Role) {
  const row = await visibleBooks(userId)
    .innerJoin("bookToCreator", "bookToCreator.bookUuid", "book.uuid")
    .where("bookToCreator.role", "=", role)
    .select((eb) =>
      eb.fn.count<number>("bookToCreator.creatorUuid").distinct().as("count"),
    )
    .executeTakeFirst()

  return row?.count ?? 0
}

async function countSmartShelf(userId: UUID, filter: ShelfFilter) {
  const row = await visibleBooks(userId)
    .where((eb) => buildFilterExpression(eb, filter, userId))
    .select((eb) => eb.fn.count<number>("book.uuid").distinct().as("count"))
    .executeTakeFirst()

  return row?.count ?? 0
}

export async function getLibraryCounts(userId: UUID): Promise<LibraryCounts> {
  const seriesP = visibleBooks(userId)
    .innerJoin("bookToSeries", "bookToSeries.bookUuid", "book.uuid")
    .select((eb) =>
      eb.fn.count<number>("bookToSeries.seriesUuid").distinct().as("count"),
    )
    .executeTakeFirst()

  const tagsP = visibleBooks(userId)
    .innerJoin("bookToTag", "bookToTag.bookUuid", "book.uuid")
    .select((eb) =>
      eb.fn.count<number>("bookToTag.tagUuid").distinct().as("count"),
    )
    .executeTakeFirst()

  // distinct publication years over visible books. substr ignores nulls, so
  // books without a date don't add a phantom year.
  const yearsP = visibleBooks(userId)
    .select(
      sql<number>`count(distinct substr(book.publication_date, 1, 4))`.as(
        "count",
      ),
    )
    .executeTakeFirst()

  // status + rating live on per-user join tables, so they're already scoped to
  // this user and need no collection-visibility join.
  const statusesP = db
    .selectFrom("bookToStatus")
    .where("bookToStatus.userId", "=", userId)
    .select((eb) =>
      eb.fn.count<number>("bookToStatus.statusUuid").distinct().as("count"),
    )
    .executeTakeFirst()

  const ratingsP = db
    .selectFrom("userBookRating")
    .where("userBookRating.userId", "=", userId)
    .where("userBookRating.rating", "is not", null)
    .select((eb) =>
      eb.fn.count<number>("userBookRating.rating").distinct().as("count"),
    )
    .executeTakeFirst()

  const collectionRowsP = db
    .selectFrom("bookToCollection")
    .select((eb) => [
      "bookToCollection.collectionUuid as uuid",
      eb.fn.count<number>("bookToCollection.bookUuid").as("count"),
    ])
    .groupBy("bookToCollection.collectionUuid")
    .execute()

  const manualShelfRowsP = db
    .selectFrom("shelfBook")
    .innerJoin("shelf", "shelf.uuid", "shelfBook.shelfUuid")
    .where("shelf.userId", "=", userId)
    .select((eb) => [
      "shelfBook.shelfUuid as uuid",
      eb.fn.count<number>("shelfBook.bookUuid").as("count"),
    ])
    .groupBy("shelfBook.shelfUuid")
    .execute()

  // smart shelves resolve via their filter, so each needs its own count query.
  // there are only a handful of shelves, so this stays cheap.
  const smartShelvesP = db
    .selectFrom("shelf")
    .select(["shelf.uuid", "shelf.filter"])
    .where("shelf.userId", "=", userId)
    .where("shelf.filter", "is not", null)
    .execute()

  const [
    series,
    authors,
    narrators,
    translators,
    tags,
    years,
    statuses,
    ratings,
    collectionRows,
    manualShelfRows,
    smartShelves,
  ] = await Promise.all([
    seriesP,
    countCreatorsByRole(userId, "aut"),
    countCreatorsByRole(userId, "nrt"),
    countCreatorsByRole(userId, "trl"),
    tagsP,
    yearsP,
    statusesP,
    ratingsP,
    collectionRowsP,
    manualShelfRowsP,
    smartShelvesP,
  ])

  const collections: Record<string, number> = {}
  for (const row of collectionRows) collections[row.uuid] = row.count

  const shelves: Record<string, number> = {}
  for (const row of manualShelfRows) shelves[row.uuid] = row.count

  const smartCounts = await Promise.all(
    smartShelves.map(async (shelf) => {
      // the column is stored as a json string; the schema types the select as
      // the parsed shape, so parse defensively in case either form shows up.
      const raw = shelf.filter as unknown
      const filter = (
        typeof raw === "string" ? JSON.parse(raw) : raw
      ) as ShelfFilter
      return [shelf.uuid, await countSmartShelf(userId, filter)] as const
    }),
  )
  for (const [uuid, count] of smartCounts) shelves[uuid] = count

  return {
    series: series?.count ?? 0,
    authors,
    narrators,
    translators,
    tags: tags?.count ?? 0,
    statuses: statuses?.count ?? 0,
    publicationYears: years?.count ?? 0,
    ratings: ratings?.count ?? 0,
    collections,
    shelves,
  }
}
