import { sql } from "kysely"

import { type Role } from "@/components/books/edit/marcRelators"
import {
  BADGE_FACET_SECTIONS,
  type BadgeFacetSection,
  FACET_SECTION_REGISTRY,
  type FacetSection,
  type FacetSectionDef,
  isFacetSection,
} from "@/facet-sections"
import { ALIGNMENT_GRADES, FORMAT_VALUES, resolveFieldAlias } from "@/fields"
import { type ShelfFilter } from "@/shelves"
import { type UUID } from "@/uuid"

import { db } from "./connection"
import { FIELD_SQL, formatPredicate } from "./fieldSql"
import { bookVisibleTo, buildFilterExpression } from "./shelfFilter"

export { type FacetSection, isFacetSection }

// a single row within a facet (one status, one rating bucket, one author). a
// facet (aka section, see FacetSection) is the dimension; a FacetValue is one
// value along it.
export type FacetValue = {
  key: string
  name: string
  bookCount: number
  icon?: string | null
  color?: string | null
  // the machine-readable kind, used for status facets to determine if the
  // status is a well-known/core status
  kind?: string
}

export const NONE_FACET_KEY = "__none__"

// per-collection / per-shelf counts stay keyed by entity uuid; the badge
// sections contribute one distinct-value count each.
export type LibraryCounts = Record<BadgeFacetSection, number> & {
  // total visible books in the whole library
  books: number
  collections: Record<string, number>
  shelves: Record<string, number>
}

export function visibleBooks(userId: UUID, dab = db) {
  return dab.selectFrom("book").where((eb) => bookVisibleTo(eb, userId))
}

async function countSmartShelf(userId: UUID, filter: ShelfFilter) {
  const row = await visibleBooks(userId)
    .where((eb) => buildFilterExpression(eb, filter, userId))
    .select((eb) => eb.fn.count<number>("book.uuid").distinct().as("count"))
    .executeTakeFirst()

  return row?.count ?? 0
}

// shelf.filter is stored as json; older rows may already be parsed objects.
function parseShelfFilter(raw: unknown): ShelfFilter {
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as ShelfFilter
}

// ---------------------------------------------------------------------------
// distinct-value counts (the sidebar badges)
// ---------------------------------------------------------------------------

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

const DISTINCT_COUNTS = {
  series: async (userId) => {
    const row = await visibleBooks(userId)
      .innerJoin("bookToSeries", "bookToSeries.bookUuid", "book.uuid")
      .select((eb) =>
        eb.fn.count<number>("bookToSeries.seriesUuid").distinct().as("count"),
      )
      .executeTakeFirst()
    return row?.count ?? 0
  },

  authors: (userId) => countCreatorsByRole(userId, "aut"),
  narrators: (userId) => countCreatorsByRole(userId, "nrt"),
  translators: (userId) => countCreatorsByRole(userId, "trl"),

  tags: async (userId) => {
    const row = await visibleBooks(userId)
      .innerJoin("bookToTag", "bookToTag.bookUuid", "book.uuid")
      .select((eb) =>
        eb.fn.count<number>("bookToTag.tagUuid").distinct().as("count"),
      )
      .executeTakeFirst()
    return row?.count ?? 0
  },

  statuses: async (userId) => {
    const row = await db
      .selectFrom("bookToStatus")
      .where("bookToStatus.userId", "=", userId)
      .select((eb) =>
        eb.fn.count<number>("bookToStatus.statusUuid").distinct().as("count"),
      )
      .executeTakeFirst()
    return row?.count ?? 0
  },

  // distinct publication years over visible books. substr ignores nulls, so
  // books without a date don't add a phantom year.
  publicationYears: async (userId) => {
    const row = await visibleBooks(userId)
      .select(
        sql<number>`count(distinct substr(book.publication_date, 1, 4))`.as(
          "count",
        ),
      )
      .executeTakeFirst()
    return row?.count ?? 0
  },

  ratings: async (userId) => {
    const row = await db
      .selectFrom("userBookRating")
      .where("userBookRating.userId", "=", userId)
      .where("userBookRating.rating", "is not", null)
      .select((eb) =>
        eb.fn.count<number>("userBookRating.rating").distinct().as("count"),
      )
      .executeTakeFirst()
    return row?.count ?? 0
  },

  identifiers: async (userId) => {
    const row = await visibleBooks(userId)
      .innerJoin("identifier", "identifier.bookUuid", "book.uuid")
      .select((eb) =>
        eb.fn
          .count<number>("identifier.identifierTypeUuid")
          .distinct()
          .as("count"),
      )
      .executeTakeFirst()
    return row?.count ?? 0
  },
} as const satisfies Record<
  BadgeFacetSection,
  (userId: UUID) => Promise<number>
>

export async function getLibraryCounts(userId: UUID): Promise<LibraryCounts> {
  const booksP = visibleBooks(userId)
    .select((eb) => eb.fn.count<number>("book.uuid").distinct().as("count"))
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

  const smartShelvesP = db
    .selectFrom("shelf")
    .select(["shelf.uuid", "shelf.filter"])
    .where("shelf.userId", "=", userId)
    .where("shelf.filter", "is not", null)
    .execute()

  const [books, collectionRows, manualShelfRows, smartShelves, ...badgeCounts] =
    await Promise.all([
      booksP,
      collectionRowsP,
      manualShelfRowsP,
      smartShelvesP,
      ...BADGE_FACET_SECTIONS.map((section) =>
        DISTINCT_COUNTS[section](userId),
      ),
    ])

  const collections: Record<string, number> = {}
  for (const row of collectionRows) collections[row.uuid] = row.count

  const shelves: Record<string, number> = {}
  for (const row of manualShelfRows) shelves[row.uuid] = row.count

  const smartCounts = await Promise.all(
    smartShelves.map(async (shelf) => {
      const filter = parseShelfFilter(shelf.filter)
      return [shelf.uuid, await countSmartShelf(userId, filter)] as const
    }),
  )
  for (const [uuid, count] of smartCounts) shelves[uuid] = count

  const badges = Object.fromEntries(
    BADGE_FACET_SECTIONS.map((section, i) => [section, badgeCounts[i] ?? 0]),
  ) as Record<BadgeFacetSection, number>

  return {
    ...badges,
    books: books?.count ?? 0,
    collections,
    shelves,
  }
}

// ---------------------------------------------------------------------------
// facet lists (one row per facet value, with book counts)
// ---------------------------------------------------------------------------

const creatorName = sql<string>`coalesce(nullif(creator.file_as, ''), creator.name)`

async function seriesFacets(userId: UUID): Promise<FacetValue[]> {
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

async function creatorFacets(userId: UUID, role: Role): Promise<FacetValue[]> {
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

async function tagFacets(userId: UUID): Promise<FacetValue[]> {
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

async function collectionFacets(userId: UUID): Promise<FacetValue[]> {
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

async function statusFacets(userId: UUID): Promise<FacetValue[]> {
  return db
    .selectFrom("status")
    .leftJoin("bookToStatus", (join) =>
      join
        .onRef("bookToStatus.statusUuid", "=", "status.uuid")
        .on("bookToStatus.userId", "=", userId),
    )
    .select((eb) => [
      "status.uuid as key",
      sql<string>`coalesce(status.label, status.name)`.as("name"),
      "status.name as kind",
      eb.fn.count<number>("bookToStatus.bookUuid").distinct().as("bookCount"),
    ])
    .groupBy(["status.uuid", "status.label", "status.name"])
    .execute()
}

async function publicationYearFacets(userId: UUID): Promise<FacetValue[]> {
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

const RATING_BUCKETS = [
  { key: "0-0.49", name: "☆☆☆☆☆", max: 0.49 },
  { key: "0.5-1.49", name: "★☆☆☆☆", max: 1.49 },
  { key: "1.5-2.49", name: "★★☆☆☆", max: 2.49 },
  { key: "2.5-3.49", name: "★★★☆☆", max: 3.49 },
  { key: "3.5-4.49", name: "★★★★☆", max: 4.49 },
  { key: "4.5-5", name: "★★★★★", max: 5 },
] as const

const TOP_RATING_BUCKET = RATING_BUCKETS[RATING_BUCKETS.length - 1] as {
  key: string
}
const ratingBucketKeyExpr = sql<string>`
  case
    ${sql.join(
      RATING_BUCKETS.slice(0, -1).map(
        (b) => sql`when user_book_rating.rating < ${b.max} then ${b.key}`,
      ),
      sql` `,
    )}
    else ${TOP_RATING_BUCKET.key}
  end
`

async function ratingFacets(userId: UUID): Promise<FacetValue[]> {
  const rows = await visibleBooks(userId)
    .innerJoin("userBookRating", (join) =>
      join
        .onRef("userBookRating.bookUuid", "=", "book.uuid")
        .on("userBookRating.userId", "=", userId),
    )
    .where("userBookRating.rating", "is not", null)
    .select((eb) => [
      ratingBucketKeyExpr.as("key"),
      eb.fn.count<number>("book.uuid").distinct().as("bookCount"),
    ])
    .groupBy(ratingBucketKeyExpr)
    .execute()

  const counts = new Map(rows.map((r) => [r.key, r.bookCount]))
  return RATING_BUCKETS.map((b) => ({
    key: b.key,
    name: b.name,
    bookCount: counts.get(b.key) ?? 0,
  }))
}

// one row per identifier type in use; the key is the type uuid, matching the
// identifiers field's qualifier.
async function identifierFacets(userId: UUID): Promise<FacetValue[]> {
  const rows = await visibleBooks(userId)
    .innerJoin("identifier", "identifier.bookUuid", "book.uuid")
    .innerJoin(
      "identifierType",
      "identifierType.uuid",
      "identifier.identifierTypeUuid",
    )
    .select((eb) => [
      "identifierType.uuid as key",
      "identifierType.name as name",
      "identifierType.kind as kind",
      eb.fn.count<number>("book.uuid").distinct().as("bookCount"),
    ])
    .groupBy(["identifierType.uuid", "identifierType.name"])
    .execute()

  return rows.map(({ kind, ...row }) => ({
    ...row,
    ...(kind ? { kind } : {}),
  }))
}

// one count per canonical format value. the values overlap (a fully synced
// book has an ebook, an audiobook and a readaloud), so counts don't sum to
// the library total; the semantics live in formatPredicate.
async function formatFacets(userId: UUID): Promise<FacetValue[]> {
  const row = await visibleBooks(userId)
    .select((eb) =>
      FORMAT_VALUES.map((value) =>
        sql<number>`count(distinct case when ${formatPredicate(eb, value)} then book.uuid end)`.as(
          value,
        ),
      ),
    )
    .executeTakeFirst()

  return FORMAT_VALUES.map((value) => ({
    key: value,
    name: value,
    bookCount: row?.[value] ?? 0,
  }))
}

const latestGradeExpr = sql<string>`(
  select grade from alignment_report
  where book_uuid = book.uuid
  order by created_at desc
  limit 1
)`

async function gradeFacets(userId: UUID): Promise<FacetValue[]> {
  const rows = await visibleBooks(userId)
    .where(latestGradeExpr, "is not", null)
    .select((eb) => [
      latestGradeExpr.as("key"),
      eb.fn.count<number>("book.uuid").distinct().as("bookCount"),
    ])
    .groupBy(latestGradeExpr)
    .execute()

  const counts = new Map(rows.map((r) => [r.key, r.bookCount]))

  // show every grade always, 0-filled, in canonical (A+ … F) order. any grade
  // outside the canonical set (defensive) is appended as-is.
  const canonical: FacetValue[] = ALIGNMENT_GRADES.map((grade) => ({
    key: grade,
    name: grade,
    bookCount: counts.get(grade) ?? 0,
  }))
  const extra: FacetValue[] = rows
    .filter((r) => !(ALIGNMENT_GRADES as readonly string[]).includes(r.key))
    .map((r) => ({ key: r.key, name: r.key, bookCount: r.bookCount }))

  return [...canonical, ...extra]
}

async function shelfFacets(userId: UUID): Promise<FacetValue[]> {
  const shelves = await db
    .selectFrom("shelf")
    .leftJoin("shelfBook", "shelfBook.shelfUuid", "shelf.uuid")
    .select((eb) => [
      "shelf.uuid as key",
      "shelf.name as name",
      "shelf.filter as filter",
      eb.fn.count<number>("shelfBook.bookUuid").distinct().as("manualCount"),
    ])
    .groupBy(["shelf.uuid", "shelf.name", "shelf.filter"])
    .where("shelf.userId", "=", userId)
    .execute()

  return Promise.all(
    shelves.map(async (shelf) => {
      const bookCount =
        shelf.filter != null
          ? await countSmartShelf(userId, parseShelfFilter(shelf.filter))
          : shelf.manualCount
      return { key: shelf.key, name: shelf.name, bookCount }
    }),
  )
}

const FACET_IMPL = {
  series: seriesFacets,
  authors: (userId) => creatorFacets(userId, "aut"),
  narrators: (userId) => creatorFacets(userId, "nrt"),
  translators: (userId) => creatorFacets(userId, "trl"),
  tags: tagFacets,
  collections: collectionFacets,
  statuses: statusFacets,
  publicationYears: publicationYearFacets,
  ratings: ratingFacets,
  formats: formatFacets,
  grades: gradeFacets,
  shelves: shelfFacets,
  identifiers: identifierFacets,
} as const satisfies Record<
  FacetSection,
  (userId: UUID) => Promise<FacetValue[]>
>

// the "(no X)" bucket reuses the bound field's isEmpty from FIELD_SQL, so the
// sidebar and the shelf filter can never disagree about what "none" means.
async function countSectionNone(
  userId: UUID,
  section: FacetSection,
): Promise<number> {
  const none: FacetSectionDef["none"] = FACET_SECTION_REGISTRY[section].none
  if (!none) return 0

  const resolved = resolveFieldAlias(none.field)
  const impl = FIELD_SQL[resolved.field as keyof typeof FIELD_SQL]
  const qualifier = resolved.qualifier ?? none.qualifier

  const row = await visibleBooks(userId)
    .where((eb) => impl.isEmpty(eb, { userId, qualifier }))
    .select((eb) => eb.fn.count<number>("book.uuid").distinct().as("count"))
    .executeTakeFirst()

  return row?.count ?? 0
}

export async function getSectionFacets(
  userId: UUID,
  section: FacetSection,
): Promise<FacetValue[]> {
  const facets = await FACET_IMPL[section](userId)

  const none = await countSectionNone(userId, section)
  if (none > 0) {
    facets.push({ key: NONE_FACET_KEY, name: "", bookCount: none })
  }

  return facets
}
