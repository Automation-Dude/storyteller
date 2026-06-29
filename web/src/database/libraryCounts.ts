import { sql } from "kysely"

import { type Role } from "@/components/books/edit/marcRelators"
import { type ShelfFilter } from "@/shelves"
import { type UUID } from "@/uuid"

import { db } from "./connection"
import { buildFilterExpression } from "./shelfFilter"

// one entry in a library section's facet list (a series, an author, a tag, a
// publication year, ...). `bookCount` is the number of visible books carrying
// that facet, computed in SQL so the sidebar never loads the whole catalog.
export type LibraryFacet = {
  key: string
  name: string
  bookCount: number
  icon?: string | null
  color?: string | null
  // the machine-readable kind, used for status facets to determine if the
  // status is a well-known/core status
  kind?: string
}

// library sections whose facet list + per-facet book counts are computed
// server-side. mirrors the keys in librarySections (library-sections.ts).
export const FACET_SECTIONS = [
  "series",
  "authors",
  "narrators",
  "translators",
  "tags",
  "collections",
  "statuses",
  "publicationYears",
  "ratings",
  "formats",
] as const

export type FacetSection = (typeof FACET_SECTIONS)[number]

export function isFacetSection(value: string): value is FacetSection {
  return (FACET_SECTIONS as readonly string[]).includes(value)
}

// the synthetic facet key for the "(no author)" / "(no series)" / ... bucket.
// kept in sync with NONE_KEY in library-sections.ts (the client supplies the
// human label; the server only computes the count).
export const NONE_FACET_KEY = "__none__"

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

// ---------------------------------------------------------------------------
// per-section facet lists (replaces extractItems over an all-books fetch)
// ---------------------------------------------------------------------------

// the displayed creator name: prefer fileAs (for "Last, First" sorting) but fall
// back to name when it's empty. raw sql bypasses the camelCase plugin.
const creatorName = sql<string>`coalesce(nullif(creator.file_as, ''), creator.name)`

async function seriesFacets(userId: UUID): Promise<LibraryFacet[]> {
  return visibleBooks(userId)
    .innerJoin("bookToSeries", "bookToSeries.bookUuid", "book.uuid")
    .innerJoin("series", "series.uuid", "bookToSeries.seriesUuid")
    .select((eb) => [
      "series.uuid as key",
      "series.name as name",
      eb.fn.count<number>("book.uuid").distinct().as("bookCount"),
    ])
    .groupBy(["series.uuid", "series.name"])
    .execute()
}

async function creatorFacets(
  userId: UUID,
  role: Role,
): Promise<LibraryFacet[]> {
  return visibleBooks(userId)
    .innerJoin("bookToCreator", "bookToCreator.bookUuid", "book.uuid")
    .innerJoin("creator", "creator.uuid", "bookToCreator.creatorUuid")
    .where("bookToCreator.role", "=", role)
    .select((eb) => [
      "creator.uuid as key",
      creatorName.as("name"),
      eb.fn.count<number>("book.uuid").distinct().as("bookCount"),
    ])
    .groupBy(["creator.uuid", creatorName])
    .execute()
}

async function tagFacets(userId: UUID): Promise<LibraryFacet[]> {
  return visibleBooks(userId)
    .innerJoin("bookToTag", "bookToTag.bookUuid", "book.uuid")
    .innerJoin("tag", "tag.uuid", "bookToTag.tagUuid")
    .select((eb) => [
      "tag.uuid as key",
      "tag.name as name",
      "tag.icon as icon",
      "tag.color as color",
      eb.fn.count<number>("book.uuid").distinct().as("bookCount"),
    ])
    .groupBy(["tag.uuid", "tag.name", "tag.icon", "tag.color"])
    .execute()
}

async function collectionFacets(userId: UUID): Promise<LibraryFacet[]> {
  // collection visibility is the gate here, so the collection table is the base
  // (its columns are non-null) rather than visibleBooks' left-joined collection.
  return db
    .selectFrom("collection")
    .innerJoin(
      "bookToCollection",
      "bookToCollection.collectionUuid",
      "collection.uuid",
    )
    .leftJoin(
      "collectionToUser",
      "collectionToUser.collectionUuid",
      "collection.uuid",
    )
    .where((eb) =>
      eb.or([
        eb("collectionToUser.userId", "=", userId),
        eb("collection.public", "=", true),
        eb("collection.public", "is", null),
      ]),
    )
    .select((eb) => [
      "collection.uuid as key",
      "collection.name as name",
      "collection.icon as icon",
      "collection.color as color",
      eb.fn
        .count<number>("bookToCollection.bookUuid")
        .distinct()
        .as("bookCount"),
    ])
    .groupBy([
      "collection.uuid",
      "collection.name",
      "collection.icon",
      "collection.color",
    ])
    .execute()
}

async function statusFacets(userId: UUID): Promise<LibraryFacet[]> {
  return visibleBooks(userId)
    .innerJoin("bookToStatus", "bookToStatus.bookUuid", "book.uuid")
    .innerJoin("status", "status.uuid", "bookToStatus.statusUuid")
    .where("bookToStatus.userId", "=", userId)
    .select((eb) => [
      "status.uuid as key",
      sql<string>`coalesce(status.label, status.name)`.as("name"),
      "status.name as kind",
      eb.fn.count<number>("book.uuid").distinct().as("bookCount"),
    ])
    .groupBy(["status.uuid", "status.label", "status.name"])
    .execute()
}

async function publicationYearFacets(userId: UUID): Promise<LibraryFacet[]> {
  const year = sql<string>`substr(book.publication_date, 1, 4)`
  return visibleBooks(userId)
    .where("book.publicationDate", "is not", null)
    .select((eb) => [
      year.as("key"),
      year.as("name"),
      eb.fn.count<number>("book.uuid").distinct().as("bookCount"),
    ])
    .groupBy(year)
    .execute()
}

async function ratingFacets(userId: UUID): Promise<LibraryFacet[]> {
  const rating = sql<string>`cast(user_book_rating.rating as text)`
  return visibleBooks(userId)
    .innerJoin("userBookRating", (join) =>
      join
        .onRef("userBookRating.bookUuid", "=", "book.uuid")
        .on("userBookRating.userId", "=", userId),
    )
    .where("userBookRating.rating", "is not", null)
    .select((eb) => [
      rating.as("key"),
      rating.as("name"),
      eb.fn.count<number>("book.uuid").distinct().as("bookCount"),
    ])
    .groupBy(rating)
    .execute()
}

// the exclusive format partition matching getFormatKey in library-sections.ts.
const formatKeyExpr = sql<string>`
  case
    when exists (
      select 1 from readaloud r
      where r.book_uuid = book.uuid and r.status = 'ALIGNED'
    ) then 'readaloud'
    when exists (select 1 from audiobook a where a.book_uuid = book.uuid)
     and exists (select 1 from ebook e where e.book_uuid = book.uuid)
      then 'audiobook-ebook'
    when exists (select 1 from audiobook a where a.book_uuid = book.uuid)
      then 'audiobook-only'
    when exists (select 1 from ebook e where e.book_uuid = book.uuid)
      then 'ebook-only'
    else 'no-media'
  end
`

async function formatFacets(userId: UUID): Promise<LibraryFacet[]> {
  return visibleBooks(userId)
    .select((eb) => [
      formatKeyExpr.as("key"),
      formatKeyExpr.as("name"),
      eb.fn.count<number>("book.uuid").distinct().as("bookCount"),
    ])
    .groupBy(formatKeyExpr)
    .execute()
}

// the count of visible books carrying none of a section's facet ("no author",
// "no series", ...). role-scoped for the creator sections so the narrators page
// counts books with no narrator (not books with no creator at all). formats is
// a total partition (no-media is already a facet), so it has no none bucket.
const NONE_CREATOR_ROLE: Partial<Record<FacetSection, Role>> = {
  authors: "aut",
  narrators: "nrt",
  translators: "trl",
}

async function countSectionNone(
  userId: UUID,
  section: FacetSection,
): Promise<number> {
  const role = NONE_CREATOR_ROLE[section]

  const row = await visibleBooks(userId)
    .where((eb) => {
      switch (section) {
        case "series":
          return eb.not(
            eb.exists(
              eb
                .selectFrom("bookToSeries")
                .select(sql.lit(1).as("one"))
                .whereRef("bookToSeries.bookUuid", "=", "book.uuid"),
            ),
          )
        case "authors":
        case "narrators":
        case "translators":
          return eb.not(
            eb.exists(
              eb
                .selectFrom("bookToCreator")
                .select(sql.lit(1).as("one"))
                .whereRef("bookToCreator.bookUuid", "=", "book.uuid")
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                .where("bookToCreator.role", "=", role!),
            ),
          )
        case "tags":
          return eb.not(
            eb.exists(
              eb
                .selectFrom("bookToTag")
                .select(sql.lit(1).as("one"))
                .whereRef("bookToTag.bookUuid", "=", "book.uuid"),
            ),
          )
        case "collections":
          return eb.not(
            eb.exists(
              eb
                .selectFrom("bookToCollection")
                .select(sql.lit(1).as("one"))
                .whereRef("bookToCollection.bookUuid", "=", "book.uuid"),
            ),
          )
        case "statuses":
          return eb.not(
            eb.exists(
              eb
                .selectFrom("bookToStatus")
                .select(sql.lit(1).as("one"))
                .whereRef("bookToStatus.bookUuid", "=", "book.uuid")
                .where("bookToStatus.userId", "=", userId),
            ),
          )
        case "ratings":
          return eb.not(
            eb.exists(
              eb
                .selectFrom("userBookRating")
                .select(sql.lit(1).as("one"))
                .whereRef("userBookRating.bookUuid", "=", "book.uuid")
                .where("userBookRating.userId", "=", userId)
                .where("userBookRating.rating", "is not", null),
            ),
          )
        case "publicationYears":
          return eb.or([
            eb("book.publicationDate", "is", null),
            eb("book.publicationDate", "=", ""),
          ])
        case "formats":
          return eb.lit(false)
      }
    })
    .select((eb) => eb.fn.count<number>("book.uuid").distinct().as("count"))
    .executeTakeFirst()

  return row?.count ?? 0
}

// the facet list (with per-facet book counts) for a library section, computed
// in SQL. counts are unconditional - they don't reflect the active grid filter,
// matching the previous client behavior and keeping the result cache-stable.
// a trailing NONE_FACET_KEY entry is appended when some visible books carry none
// of the facet, so the sidebar can offer the "(no author)" bucket.
export async function getSectionFacets(
  userId: UUID,
  section: FacetSection,
): Promise<LibraryFacet[]> {
  const facets = await getSectionFacetList(userId, section)

  if (section === "formats") return facets

  const none = await countSectionNone(userId, section)
  if (none > 0) {
    facets.push({ key: NONE_FACET_KEY, name: "", bookCount: none })
  }

  return facets
}

function getSectionFacetList(
  userId: UUID,
  section: FacetSection,
): Promise<LibraryFacet[]> {
  switch (section) {
    case "series":
      return seriesFacets(userId)
    case "authors":
      return creatorFacets(userId, "aut")
    case "narrators":
      return creatorFacets(userId, "nrt")
    case "translators":
      return creatorFacets(userId, "trl")
    case "tags":
      return tagFacets(userId)
    case "collections":
      return collectionFacets(userId)
    case "statuses":
      return statusFacets(userId)
    case "publicationYears":
      return publicationYearFacets(userId)
    case "ratings":
      return ratingFacets(userId)
    case "formats":
      return formatFacets(userId)
  }
}
