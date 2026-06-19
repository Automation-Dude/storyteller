import {
  type ExpressionBuilder,
  type ExpressionWrapper,
  type SqlBool,
  sql,
} from "kysely"

import { type Role } from "@/components/books/edit/marcRelators"
import {
  type ShelfFilter,
  type ShelfFilterCondition,
  type ShelfFilterField,
  type ShelfFilterNode,
  type ShelfFilterOperator,
  type ShelfFilterValue,
  getFieldType,
} from "@/shelves"
import { type SortField } from "@/sort"
import { type UUID } from "@/uuid"

import { db } from "./connection"
import { type DB } from "./schema"

export function extractEntityReferences(filter: ShelfFilter): Array<{
  entityType: "tag" | "collection" | "series" | "status" | "creator"
  entityUuid: UUID
}> {
  const refs: Array<{
    entityType: "tag" | "collection" | "series" | "status" | "creator"
    entityUuid: UUID
  }> = []

  function walk(node: ShelfFilterNode) {
    if (node.type === "condition") {
      const fieldToEntityType: Partial<
        Record<
          ShelfFilterField,
          "tag" | "collection" | "series" | "status" | "creator"
        >
      > = {
        tags: "tag",
        collections: "collection",
        series: "series",
        status: "status",
        creators: "creator",
      }

      const entityType = fieldToEntityType[node.field]
      if (!entityType) return

      if (node.value === undefined || node.value === null) return

      const values = Array.isArray(node.value) ? node.value : [node.value]
      for (const v of values) {
        if (typeof v === "string") {
          refs.push({ entityType, entityUuid: v as UUID })
        }
      }

      return
    }

    if (node.type === "not") {
      walk(node.child)
      return
    }

    for (const child of node.children) {
      walk(child)
    }
  }

  walk(filter)
  return refs
}

export function removeDeletedEntityReferences(
  filter: ShelfFilter,
  entityType: "tag" | "collection" | "series" | "status" | "creator",
  entityUuid: string,
): ShelfFilter | null {
  const entityTypeToField: Record<typeof entityType, ShelfFilterField> = {
    tag: "tags",
    collection: "collections",
    series: "series",
    status: "status",
    creator: "creators",
  }

  const targetField = entityTypeToField[entityType]

  function walk(node: ShelfFilterNode): ShelfFilterNode | null {
    if (node.type === "condition") {
      if (node.field !== targetField) return node

      if (node.value === undefined || node.value === null) return node

      if (Array.isArray(node.value)) {
        const filtered = node.value.filter((v) => v !== entityUuid)
        if (filtered.length === 0) return null
        return { ...node, value: filtered }
      }

      if (node.value === entityUuid) return null
      return node
    }

    if (node.type === "not") {
      const newChild = walk(node.child)
      if (!newChild) return null
      return { ...node, child: newChild }
    }

    const newChildren = node.children
      .map(walk)
      .filter((c): c is ShelfFilterNode => c !== null)

    if (newChildren.length === 0) return null
    return { ...node, children: newChildren }
  }

  return walk(filter)
}

/**
 * when an entity (tag, creator, series, collection, status) is deleted,
 * remove references to it from every shelf filter that mentions it.
 * shelves whose filter becomes empty are left with a null filter.
 */
export async function cleanShelfFiltersForDeletedEntity(
  entityType: "tag" | "collection" | "series" | "status" | "creator",
  entityUuid: UUID,
) {
  const refs = await db
    .selectFrom("shelfFilterReference")
    .innerJoin("shelf", "shelf.uuid", "shelfFilterReference.shelfUuid")
    .select(["shelf.uuid", "shelf.filter", "shelf.userId"])
    .where("shelfFilterReference.entityType", "=", entityType)
    .where("shelfFilterReference.entityUuid", "=", entityUuid)
    .execute()

  for (const shelf of refs) {
    const filter = shelf.filter
      ? typeof shelf.filter === "string"
        ? (JSON.parse(shelf.filter) as ShelfFilter)
        : shelf.filter
      : null

    if (!filter) continue

    const cleaned = removeDeletedEntityReferences(
      filter,
      entityType,
      entityUuid,
    )

    await db
      .updateTable("shelf")
      .set({ filter: cleaned ? JSON.stringify(cleaned) : null })
      .where("uuid", "=", shelf.uuid)
      .execute()

    await db
      .deleteFrom("shelfFilterReference")
      .where("shelfUuid", "=", shelf.uuid)
      .execute()

    if (cleaned) {
      const newRefs = extractEntityReferences(cleaned)

      if (newRefs.length > 0) {
        await db
          .insertInto("shelfFilterReference")
          .values(
            newRefs.map((ref) => ({
              shelfUuid: shelf.uuid,
              entityType: ref.entityType,
              entityUuid: ref.entityUuid,
            })),
          )
          .execute()
      }
    }
  }
}

// ---------------------------------------------------------------------------
// kysely expression builders
// ---------------------------------------------------------------------------

type EB = ExpressionBuilder<DB, "book">
type FilterExpression = ExpressionWrapper<DB, "book", SqlBool>

export function buildFilterExpression(
  eb: EB,
  node: ShelfFilterNode,
  userId?: UUID,
): FilterExpression {
  switch (node.type) {
    case "and":
      if (node.children.length === 0) return eb.lit(true)
      return eb.and(
        node.children.map((child) => buildFilterExpression(eb, child, userId)),
      )

    case "or":
      if (node.children.length === 0) return eb.lit(false)
      return eb.or(
        node.children.map((child) => buildFilterExpression(eb, child, userId)),
      )

    case "not":
      return eb.not(buildFilterExpression(eb, node.child, userId))

    case "condition":
      return buildConditionExpression(eb, node, userId)
  }
}

// fields whose comparison/emptiness lives on the book row or its direct
// relations. review, ratingDimension and search are handled up front because
// they query userBookRating (and ratingDimension carries an extra `dimension`).
type ScalarField = Exclude<
  ShelfFilterField,
  "review" | "ratingDimension" | "search"
>

function buildConditionExpression(
  eb: EB,
  condition: ShelfFilterCondition,
  userId?: UUID,
): FilterExpression {
  const { field, operator, value, role } = condition

  if (field === "review") {
    return buildReviewComparison(eb, operator, value, userId)
  }

  if (field === "ratingDimension") {
    return buildRatingDimensionComparison(
      eb,
      condition.dimension,
      operator,
      value,
      userId,
    )
  }

  if (field === "search") {
    if (value === undefined || value === null) return eb.lit(true)
    return buildBookSearchExpression(eb, String(value))
  }

  if (operator === "isEmpty") {
    return buildIsEmptyExpression(eb, field, userId, role)
  }

  if (operator === "isNotEmpty") {
    return eb.not(buildIsEmptyExpression(eb, field, userId, role))
  }

  if (value === undefined || value === null) {
    return eb.lit(true)
  }

  return buildComparisonExpression(eb, field, operator, value, userId, role)
}

function buildIsEmptyExpression(
  eb: EB,
  field: ScalarField,
  userId?: UUID,
  role?: string,
): FilterExpression {
  switch (field) {
    case "title":
      return eb.or([eb("book.title", "is", null), eb("book.title", "=", "")])

    case "subtitle":
      return eb.or([
        eb("book.subtitle", "is", null),
        eb("book.subtitle", "=", ""),
      ])

    case "description":
      return eb.or([
        eb("book.description", "is", null),
        eb("book.description", "=", ""),
      ])

    case "language":
      return eb.or([
        eb("book.language", "is", null),
        eb("book.language", "=", ""),
      ])

    case "publicationDate":
      return eb("book.publicationDate", "is", null)

    case "createdAt":
      return eb("book.createdAt", "is", null)

    case "updatedAt":
      return eb("book.updatedAt", "is", null)

    case "userRating":
      return eb.not(
        eb.exists(
          eb
            .selectFrom("userBookRating")
            .select(sql.lit(1).as("one"))
            .whereRef("userBookRating.bookUuid", "=", "book.uuid")
            .$if(!!userId, (qb) =>
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              qb.where("userBookRating.userId", "=", userId!),
            )
            .where("userBookRating.rating", "is not", null),
        ),
      )

    case "duration":
      return eb.and([
        eb.not(
          eb.exists(
            eb
              .selectFrom("audiobook")
              .select(sql.lit(1).as("one"))
              .whereRef("audiobook.bookUuid", "=", "book.uuid")
              .where("audiobook.duration", "is not", null),
          ),
        ),
        eb.not(
          eb.exists(
            eb
              .selectFrom("readaloud")
              .select(sql.lit(1).as("one"))
              .whereRef("readaloud.bookUuid", "=", "book.uuid")
              .where("readaloud.duration", "is not", null),
          ),
        ),
        eb("book.duration", "is", null),
      ])

    case "pageCount":
      return eb.and([
        eb.not(
          eb.exists(
            eb
              .selectFrom("ebook")
              .select(sql.lit(1).as("one"))
              .whereRef("ebook.bookUuid", "=", "book.uuid")
              .where("ebook.pageCount", "is not", null),
          ),
        ),
        eb.not(
          eb.exists(
            eb
              .selectFrom("readaloud")
              .select(sql.lit(1).as("one"))
              .whereRef("readaloud.bookUuid", "=", "book.uuid")
              .where("readaloud.pageCount", "is not", null),
          ),
        ),
        eb("book.pageCount", "is", null),
      ])

    case "fileSize":
      return eb.and([
        eb.not(
          eb.exists(
            eb
              .selectFrom("ebook")
              .select(sql.lit(1).as("one"))
              .whereRef("ebook.bookUuid", "=", "book.uuid")
              .where("ebook.fileSize", "is not", null),
          ),
        ),
        eb.not(
          eb.exists(
            eb
              .selectFrom("audiobook")
              .select(sql.lit(1).as("one"))
              .whereRef("audiobook.bookUuid", "=", "book.uuid")
              .where("audiobook.fileSize", "is not", null),
          ),
        ),
        eb.not(
          eb.exists(
            eb
              .selectFrom("readaloud")
              .select(sql.lit(1).as("one"))
              .whereRef("readaloud.bookUuid", "=", "book.uuid")
              .where("readaloud.fileSize", "is not", null),
          ),
        ),
      ])

    case "status":
      return eb.not(
        eb.exists(
          eb
            .selectFrom("bookToStatus")
            .select(sql.lit(1).as("one"))
            .whereRef("bookToStatus.bookUuid", "=", "book.uuid")
            .$if(!!userId, (qb) =>
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              qb.where("bookToStatus.userId", "=", userId!),
            ),
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

    case "series":
      return eb.not(
        eb.exists(
          eb
            .selectFrom("bookToSeries")
            .select(sql.lit(1).as("one"))
            .whereRef("bookToSeries.bookUuid", "=", "book.uuid"),
        ),
      )

    case "creators":
      return eb.not(
        eb.exists(
          eb
            .selectFrom("bookToCreator")
            .select(sql.lit(1).as("one"))
            .whereRef("bookToCreator.bookUuid", "=", "book.uuid")
            .$if(!!role, (qb) =>
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              qb.where("bookToCreator.role", "=", role! as Role),
            ),
        ),
      )

    case "mediaType":
      return eb.and([
        eb.not(
          eb.exists(
            eb
              .selectFrom("ebook")
              .select(sql.lit(1).as("one"))
              .whereRef("ebook.bookUuid", "=", "book.uuid"),
          ),
        ),
        eb.not(
          eb.exists(
            eb
              .selectFrom("audiobook")
              .select(sql.lit(1).as("one"))
              .whereRef("audiobook.bookUuid", "=", "book.uuid"),
          ),
        ),
        eb.not(
          eb.exists(
            eb
              .selectFrom("readaloud")
              .select(sql.lit(1).as("one"))
              .whereRef("readaloud.bookUuid", "=", "book.uuid"),
          ),
        ),
      ])
  }
}

function buildComparisonExpression(
  eb: EB,
  field: ScalarField,
  operator: ShelfFilterOperator,
  value: ShelfFilterValue,
  userId?: UUID,
  role?: string,
): FilterExpression {
  const fieldType = getFieldType(field)

  if (field === "userRating") {
    return buildUserRatingComparison(eb, operator, value, userId)
  }

  const isAssetNumeric =
    field === "fileSize" || field === "duration" || field === "pageCount"

  if (isAssetNumeric) {
    return buildAssetNumericComparison(eb, field, operator, value)
  }

  switch (fieldType) {
    case "string":
      return buildStringComparison(
        eb,
        field as "title" | "subtitle" | "description" | "language",
        operator,
        value,
      )
    case "number":
      // every numeric field is intercepted before the switch (userRating via
      // its subquery; pageCount / duration / fileSize as asset numerics), so
      // this branch is unreachable - kept only for switch exhaustiveness.
      return eb.lit(true)
    case "date":
      return buildDateComparison(
        eb,
        field as "publicationDate" | "createdAt" | "updatedAt",
        operator,
        value,
      )
    case "uuid":
      return buildUuidComparison(eb, field as "status", operator, value, userId)
    case "array":
      return buildArrayComparison(
        eb,
        field as "tags" | "collections" | "series" | "creators",
        operator,
        value,
        role,
      )
    case "enum":
      return buildEnumComparison(eb, field as "mediaType", operator, value)
    default: {
      const _exhaustive: never = fieldType
      return eb.lit(true)
    }
  }
}

function buildStringComparison(
  eb: EB,
  field: "title" | "subtitle" | "description" | "language",
  operator: ShelfFilterOperator,
  value: ShelfFilterValue,
): FilterExpression {
  const column = `book.${field}` as const
  const strValue = String(value)

  switch (operator) {
    case "is":
      return eb(sql`lower(${sql.ref(column)})`, "=", strValue.toLowerCase())

    case "isNot":
      return eb(sql`lower(${sql.ref(column)})`, "!=", strValue.toLowerCase())

    case "contains":
      return eb(
        sql`lower(${sql.ref(column)})`,
        "like",
        `%${strValue.toLowerCase()}%`,
      )

    case "notContains":
      return eb.or([
        eb(column, "is", null),
        eb.not(
          eb(
            sql`lower(${sql.ref(column)})`,
            "like",
            `%${strValue.toLowerCase()}%`,
          ),
        ),
      ])

    case "startsWith":
      return eb(
        sql`lower(${sql.ref(column)})`,
        "like",
        `${strValue.toLowerCase()}%`,
      )

    case "endsWith":
      return eb(
        sql`lower(${sql.ref(column)})`,
        "like",
        `%${strValue.toLowerCase()}`,
      )

    case "isAnyOf":
      if (!Array.isArray(value)) return eb.lit(true)
      return eb(
        sql`lower(${sql.ref(column)})`,
        "in",
        value.map((v) => String(v).toLowerCase()),
      )

    case "isNoneOf":
      if (!Array.isArray(value)) return eb.lit(true)
      return eb.or([
        eb(column, "is", null),
        eb.not(
          eb(
            sql`lower(${sql.ref(column)})`,
            "in",
            value.map((v) => String(v).toLowerCase()),
          ),
        ),
      ])

    default:
      return eb.lit(true)
  }
}

function buildUserRatingComparison(
  eb: EB,
  operator: ShelfFilterOperator,
  value: ShelfFilterValue,
  userId?: UUID,
): FilterExpression {
  // user rating lives in the userBookRating table, not on book directly
  const ratingSubquery = eb
    .selectFrom("userBookRating")
    .select("userBookRating.rating")
    .whereRef("userBookRating.bookUuid", "=", "book.uuid")
    .$if(!!userId, (qb) =>
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      qb.where("userBookRating.userId", "=", userId!),
    )

  switch (operator) {
    case "is":
      return eb.exists(
        ratingSubquery
          .where("userBookRating.rating", "=", Number(value))
          .select(sql.lit(1).as("one")),
      )

    case "isNot":
      return eb.or([
        eb.not(eb.exists(ratingSubquery.select(sql.lit(1).as("one")))),
        eb.exists(
          ratingSubquery
            .where("userBookRating.rating", "!=", Number(value))
            .select(sql.lit(1).as("one")),
        ),
      ])

    case "greaterThan":
      return eb.exists(
        ratingSubquery
          .where("userBookRating.rating", ">", Number(value))
          .select(sql.lit(1).as("one")),
      )

    case "lessThan":
      return eb.exists(
        ratingSubquery
          .where("userBookRating.rating", "<", Number(value))
          .select(sql.lit(1).as("one")),
      )

    case "greaterOrEqual":
      return eb.exists(
        ratingSubquery
          .where("userBookRating.rating", ">=", Number(value))
          .select(sql.lit(1).as("one")),
      )

    case "lessOrEqual":
      return eb.exists(
        ratingSubquery
          .where("userBookRating.rating", "<=", Number(value))
          .select(sql.lit(1).as("one")),
      )

    case "between":
      if (!Array.isArray(value) || value.length !== 2) return eb.lit(true)
      return eb.exists(
        ratingSubquery
          .where("userBookRating.rating", ">=", Number(value[0]))
          .where("userBookRating.rating", "<=", Number(value[1]))
          .select(sql.lit(1).as("one")),
      )

    default:
      return eb.lit(true)
  }
}

function buildReviewComparison(
  eb: EB,
  operator: ShelfFilterOperator,
  value: ShelfFilterValue | undefined,
  userId?: UUID,
): FilterExpression {
  // the review text lives in userBookRating, per user. each operator becomes an
  // exists / not-exists against the user's row.
  const base = eb
    .selectFrom("userBookRating")
    .select(sql.lit(1).as("one"))
    .whereRef("userBookRating.bookUuid", "=", "book.uuid")
    .$if(!!userId, (qb) =>
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      qb.where("userBookRating.userId", "=", userId!),
    )

  if (operator === "isEmpty") {
    return eb.not(
      eb.exists(base.where("userBookRating.review", "is not", null)),
    )
  }

  if (operator === "isNotEmpty") {
    return eb.exists(base.where("userBookRating.review", "is not", null))
  }

  if (value === undefined || value === null) return eb.lit(true)

  const lower = sql`lower(${sql.ref("userBookRating.review")})`
  const str = String(value).toLowerCase()

  switch (operator) {
    case "is":
      return eb.exists(base.where(lower, "=", str))
    case "isNot":
      return eb.not(eb.exists(base.where(lower, "=", str)))
    case "contains":
      return eb.exists(base.where(lower, "like", `%${str}%`))
    case "notContains":
      return eb.not(eb.exists(base.where(lower, "like", `%${str}%`)))
    case "startsWith":
      return eb.exists(base.where(lower, "like", `${str}%`))
    case "endsWith":
      return eb.exists(base.where(lower, "like", `%${str}`))
    default:
      return eb.lit(true)
  }
}

function buildRatingDimensionComparison(
  eb: EB,
  dimension: string | undefined,
  operator: ShelfFilterOperator,
  value: ShelfFilterValue | undefined,
  userId?: UUID,
): FilterExpression {
  if (!dimension) return eb.lit(true)

  // the per-axis scores are a json object on userBookRating.dimensions; pull out
  // the requested axis with json_extract (the path is a bound value, not
  // interpolated sql).
  const path = `$.${dimension}`
  const score = sql<number>`json_extract(${sql.ref("userBookRating.dimensions")}, ${path})`
  const base = eb
    .selectFrom("userBookRating")
    .select(sql.lit(1).as("one"))
    .whereRef("userBookRating.bookUuid", "=", "book.uuid")
    .$if(!!userId, (qb) =>
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      qb.where("userBookRating.userId", "=", userId!),
    )

  if (operator === "isEmpty") {
    return eb.not(eb.exists(base.where(score, "is not", null)))
  }

  if (operator === "isNotEmpty") {
    return eb.exists(base.where(score, "is not", null))
  }

  if (value === undefined || value === null) return eb.lit(true)

  switch (operator) {
    case "is":
      return eb.exists(base.where(score, "=", Number(value)))
    case "isNot":
      return eb.not(eb.exists(base.where(score, "=", Number(value))))
    case "greaterThan":
      return eb.exists(base.where(score, ">", Number(value)))
    case "lessThan":
      return eb.exists(base.where(score, "<", Number(value)))
    case "greaterOrEqual":
      return eb.exists(base.where(score, ">=", Number(value)))
    case "lessOrEqual":
      return eb.exists(base.where(score, "<=", Number(value)))
    case "between":
      if (!Array.isArray(value) || value.length !== 2) return eb.lit(true)
      return eb.exists(
        base
          .where(score, ">=", Number(value[0]))
          .where(score, "<=", Number(value[1])),
      )
    default:
      return eb.lit(true)
  }
}

/**
 * generic free-text search across a book's title, authors and series. shared
 * with getBooks (database/books.ts) so the `search` shelf field and the books
 * list query stay in sync; swap this out when full-text search lands.
 */
export function buildBookSearchExpression(
  eb: EB,
  term: string,
): FilterExpression {
  const searchTerm = `%${term.toLowerCase()}%`

  return eb.or([
    eb(sql`lower(book.title)`, "like", searchTerm),
    eb.exists(
      eb
        .selectFrom("creator")
        .select(sql.lit(1).as("one"))
        .innerJoin("bookToCreator", "bookToCreator.creatorUuid", "creator.uuid")
        .whereRef("bookToCreator.bookUuid", "=", "book.uuid")
        .where(sql`lower(creator.name)`, "like", searchTerm),
    ),
    eb.exists(
      eb
        .selectFrom("series")
        .select(sql.lit(1).as("one"))
        .innerJoin("bookToSeries", "bookToSeries.seriesUuid", "series.uuid")
        .whereRef("bookToSeries.bookUuid", "=", "book.uuid")
        .where(sql`lower(series.name)`, "like", searchTerm),
    ),
  ])
}

// the order-by expression for a sortable field. raw sql so it bypasses the
// camelCase plugin (hence snake_case columns); userRating and seriesPosition are
// correlated scalar subqueries scoped to the user / context series. interpolated
// values (${...}) are bound parameters, not string-concatenated sql.
export function buildSortExpression(
  field: SortField,
  ctx?: { userId?: UUID; seriesContext?: UUID | null },
) {
  switch (field) {
    case "title":
      return sql`book.title`
    case "createdAt":
      return sql`book.created_at`
    case "updatedAt":
      return sql`book.updated_at`
    case "publicationDate":
      return sql`book.publication_date`
    case "language":
      return sql`book.language`
    case "pageCount":
    case "duration":
    case "fileSize":
      return assetNumericExpr(field)
    case "userRating":
      return ctx?.userId
        ? sql`(select rating from user_book_rating where book_uuid = book.uuid and user_id = ${ctx.userId} limit 1)`
        : sql`(select rating from user_book_rating where book_uuid = book.uuid limit 1)`
    case "seriesPosition":
      return ctx?.seriesContext
        ? sql`(select position from book_to_series where book_uuid = book.uuid and series_uuid = ${ctx.seriesContext} limit 1)`
        : sql`null`
  }
}

// resolves the effective value for pageCount, duration, and fileSize by looking
// at the asset tables with appropriate fallback logic:
//
// - pageCount: ebook page count, fallback to readaloud, fallback to book
// - duration: audiobook duration, fallback to readaloud, fallback to book
// - fileSize: max across ebook, audiobook, and readaloud (not ideal since
//   ideally you'd filter by a specific format, but good enough until we add
//   per-format filtering)
function assetNumericExpr(
  field: "fileSize" | "duration" | "pageCount",
): ReturnType<typeof sql<number>> {
  switch (field) {
    case "pageCount":
      return sql<number>`coalesce(
        (select e.page_count from ebook e where e.book_uuid = book.uuid),
        (select r.page_count from readaloud r where r.book_uuid = book.uuid),
        book.page_count
      )`

    case "duration":
      return sql<number>`coalesce(
        (select a.duration from audiobook a where a.book_uuid = book.uuid),
        (select r.duration from readaloud r where r.book_uuid = book.uuid),
        book.duration
      )`

    case "fileSize":
      return sql<number>`coalesce(
        (select max(s.file_size) from (
          select e.file_size from ebook e where e.book_uuid = book.uuid
          union all
          select a.file_size from audiobook a where a.book_uuid = book.uuid
          union all
          select r.file_size from readaloud r where r.book_uuid = book.uuid
        ) s),
        0
      )`
  }
}

function buildAssetNumericComparison(
  eb: EB,
  field: "fileSize" | "duration" | "pageCount",
  operator: ShelfFilterOperator,
  value: ShelfFilterValue,
): FilterExpression {
  const expr = assetNumericExpr(field)

  switch (operator) {
    case "is":
      return eb(expr, "=", Number(value))

    case "isNot":
      return eb(expr, "!=", Number(value))

    case "greaterThan":
      return eb(expr, ">", Number(value))

    case "lessThan":
      return eb(expr, "<", Number(value))

    case "greaterOrEqual":
      return eb(expr, ">=", Number(value))

    case "lessOrEqual":
      return eb(expr, "<=", Number(value))

    case "between":
      if (!Array.isArray(value) || value.length !== 2) return eb.lit(true)
      return eb.and([
        eb(expr, ">=", Number(value[0])),
        eb(expr, "<=", Number(value[1])),
      ])

    default:
      return eb.lit(true)
  }
}



function buildDateComparison(
  eb: EB,
  field: "publicationDate" | "createdAt" | "updatedAt",
  operator: ShelfFilterOperator,
  value: ShelfFilterValue,
): FilterExpression {
  const column = `book.${field}` as const

  switch (operator) {
    case "is":
      return eb(column, "=", String(value))

    case "isNot":
      return eb(column, "!=", String(value))

    case "before":
      return eb(column, "<", String(value))

    case "after":
      return eb(column, ">", String(value))

    case "between":
      if (!Array.isArray(value) || value.length !== 2) return eb.lit(true)
      return eb.and([
        eb(column, ">=", String(value[0])),
        eb(column, "<=", String(value[1])),
      ])

    default:
      return eb.lit(true)
  }
}

function buildUuidComparison(
  eb: EB,
  _field: "status",
  operator: ShelfFilterOperator,
  value: ShelfFilterValue,
  userId?: UUID,
): FilterExpression {
  switch (operator) {
    case "is":
      return eb.exists(
        eb
          .selectFrom("bookToStatus")
          .select(sql.lit(1).as("one"))
          .whereRef("bookToStatus.bookUuid", "=", "book.uuid")
          .where("bookToStatus.statusUuid", "=", String(value) as UUID)
          .$if(!!userId, (qb) =>
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            qb.where("bookToStatus.userId", "=", userId!),
          ),
      )

    case "isNot":
      return eb.not(
        eb.exists(
          eb
            .selectFrom("bookToStatus")
            .select(sql.lit(1).as("one"))
            .whereRef("bookToStatus.bookUuid", "=", "book.uuid")
            .where("bookToStatus.statusUuid", "=", String(value) as UUID)
            .$if(!!userId, (qb) =>
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              qb.where("bookToStatus.userId", "=", userId!),
            ),
        ),
      )

    case "isAnyOf":
      if (!Array.isArray(value)) return eb.lit(true)
      return eb.exists(
        eb
          .selectFrom("bookToStatus")
          .select(sql.lit(1).as("one"))
          .whereRef("bookToStatus.bookUuid", "=", "book.uuid")
          .where(
            "bookToStatus.statusUuid",
            "in",
            value.map((v) => String(v) as UUID),
          )
          .$if(!!userId, (qb) =>
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            qb.where("bookToStatus.userId", "=", userId!),
          ),
      )

    case "isNoneOf":
      if (!Array.isArray(value)) return eb.lit(true)
      return eb.not(
        eb.exists(
          eb
            .selectFrom("bookToStatus")
            .select(sql.lit(1).as("one"))
            .whereRef("bookToStatus.bookUuid", "=", "book.uuid")
            .where(
              "bookToStatus.statusUuid",
              "in",
              value.map((v) => String(v) as UUID),
            )
            .$if(!!userId, (qb) =>
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              qb.where("bookToStatus.userId", "=", userId!),
            ),
        ),
      )

    default:
      return eb.lit(true)
  }
}

function buildArrayComparison(
  eb: EB,
  field: "tags" | "collections" | "series" | "creators",
  operator: ShelfFilterOperator,
  value: ShelfFilterValue,
  role?: string,
): FilterExpression {
  if (!Array.isArray(value)) return eb.lit(true)

  const uuids = value.map((v) => String(v) as UUID)

  switch (field) {
    case "tags":
      return buildTagComparison(eb, operator, uuids)
    case "collections":
      return buildCollectionComparison(eb, operator, uuids)
    case "series":
      return buildSeriesComparison(eb, operator, uuids)
    case "creators":
      return buildCreatorComparison(eb, operator, uuids, role)
  }
}

function buildTagComparison(
  eb: EB,
  operator: ShelfFilterOperator,
  uuids: UUID[],
): FilterExpression {
  switch (operator) {
    case "includes":
      return eb.exists(
        eb
          .selectFrom("bookToTag")
          .select(sql.lit(1).as("one"))
          .whereRef("bookToTag.bookUuid", "=", "book.uuid")
          .where("bookToTag.tagUuid", "in", uuids),
      )

    case "includesAll":
      return eb.and(
        uuids.map((uuid) =>
          eb.exists(
            eb
              .selectFrom("bookToTag")
              .select(sql.lit(1).as("one"))
              .whereRef("bookToTag.bookUuid", "=", "book.uuid")
              .where("bookToTag.tagUuid", "=", uuid),
          ),
        ),
      )

    case "excludes":
      return eb.not(
        eb.exists(
          eb
            .selectFrom("bookToTag")
            .select(sql.lit(1).as("one"))
            .whereRef("bookToTag.bookUuid", "=", "book.uuid")
            .where("bookToTag.tagUuid", "in", uuids),
        ),
      )

    default:
      return eb.lit(true)
  }
}

function buildCollectionComparison(
  eb: EB,
  operator: ShelfFilterOperator,
  uuids: UUID[],
): FilterExpression {
  switch (operator) {
    case "includes":
      return eb.exists(
        eb
          .selectFrom("bookToCollection")
          .select(sql.lit(1).as("one"))
          .whereRef("bookToCollection.bookUuid", "=", "book.uuid")
          .where("bookToCollection.collectionUuid", "in", uuids),
      )

    case "includesAll":
      return eb.and(
        uuids.map((uuid) =>
          eb.exists(
            eb
              .selectFrom("bookToCollection")
              .select(sql.lit(1).as("one"))
              .whereRef("bookToCollection.bookUuid", "=", "book.uuid")
              .where("bookToCollection.collectionUuid", "=", uuid),
          ),
        ),
      )

    case "excludes":
      return eb.not(
        eb.exists(
          eb
            .selectFrom("bookToCollection")
            .select(sql.lit(1).as("one"))
            .whereRef("bookToCollection.bookUuid", "=", "book.uuid")
            .where("bookToCollection.collectionUuid", "in", uuids),
        ),
      )

    default:
      return eb.lit(true)
  }
}

function buildSeriesComparison(
  eb: EB,
  operator: ShelfFilterOperator,
  uuids: UUID[],
): FilterExpression {
  switch (operator) {
    case "includes":
      return eb.exists(
        eb
          .selectFrom("bookToSeries")
          .select(sql.lit(1).as("one"))
          .whereRef("bookToSeries.bookUuid", "=", "book.uuid")
          .where("bookToSeries.seriesUuid", "in", uuids),
      )

    case "includesAll":
      return eb.and(
        uuids.map((uuid) =>
          eb.exists(
            eb
              .selectFrom("bookToSeries")
              .select(sql.lit(1).as("one"))
              .whereRef("bookToSeries.bookUuid", "=", "book.uuid")
              .where("bookToSeries.seriesUuid", "=", uuid),
          ),
        ),
      )

    case "excludes":
      return eb.not(
        eb.exists(
          eb
            .selectFrom("bookToSeries")
            .select(sql.lit(1).as("one"))
            .whereRef("bookToSeries.bookUuid", "=", "book.uuid")
            .where("bookToSeries.seriesUuid", "in", uuids),
        ),
      )

    default:
      return eb.lit(true)
  }
}

function buildCreatorComparison(
  eb: EB,
  operator: ShelfFilterOperator,
  uuids: UUID[],
  role?: string,
): FilterExpression {
  // scope the membership test to a single relator role (author / narrator /
  // translator) when asked; absent role matches a person in any role.
  switch (operator) {
    case "includes":
      return eb.exists(
        eb
          .selectFrom("bookToCreator")
          .select(sql.lit(1).as("one"))
          .whereRef("bookToCreator.bookUuid", "=", "book.uuid")
          .where("bookToCreator.creatorUuid", "in", uuids)
          .$if(!!role, (qb) =>
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            qb.where("bookToCreator.role", "=", role! as Role),
          ),
      )

    case "includesAll":
      return eb.and(
        uuids.map((uuid) =>
          eb.exists(
            eb
              .selectFrom("bookToCreator")
              .select(sql.lit(1).as("one"))
              .whereRef("bookToCreator.bookUuid", "=", "book.uuid")
              .where("bookToCreator.creatorUuid", "=", uuid)
              .$if(!!role, (qb) =>
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                qb.where("bookToCreator.role", "=", role! as Role),
              ),
          ),
        ),
      )

    case "excludes":
      return eb.not(
        eb.exists(
          eb
            .selectFrom("bookToCreator")
            .select(sql.lit(1).as("one"))
            .whereRef("bookToCreator.bookUuid", "=", "book.uuid")
            .where("bookToCreator.creatorUuid", "in", uuids)
            .$if(!!role, (qb) =>
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              qb.where("bookToCreator.role", "=", role! as Role),
            ),
        ),
      )

    default:
      return eb.lit(true)
  }
}

function buildEnumComparison(
  eb: EB,
  _field: "mediaType",
  operator: ShelfFilterOperator,
  value: ShelfFilterValue,
): FilterExpression {
  const hasEbook = eb.exists(
    eb
      .selectFrom("ebook")
      .select(sql.lit(1).as("one"))
      .whereRef("ebook.bookUuid", "=", "book.uuid"),
  )
  const hasAudiobook = eb.exists(
    eb
      .selectFrom("audiobook")
      .select(sql.lit(1).as("one"))
      .whereRef("audiobook.bookUuid", "=", "book.uuid"),
  )
  const hasAligned = eb.exists(
    eb
      .selectFrom("readaloud")
      .select(sql.lit(1).as("one"))
      .whereRef("readaloud.bookUuid", "=", "book.uuid")
      .where("readaloud.status", "=", "ALIGNED"),
  )

  // the first three are broad (does the book have this asset at all); the rest
  // are composites mirroring getFormatKey in library-sections.ts.
  const mediaTypeCondition = (type: string): FilterExpression => {
    switch (type) {
      case "ebook":
        return hasEbook
      case "audiobook":
        return hasAudiobook
      case "synced":
        return hasAligned
      case "ebook-only":
        return eb.and([hasEbook, eb.not(hasAudiobook)])
      case "audiobook-only":
        return eb.and([hasAudiobook, eb.not(hasEbook)])
      case "missing-readaloud":
        return eb.and([hasEbook, hasAudiobook, eb.not(hasAligned)])
      case "no-media":
        return eb.and([eb.not(hasEbook), eb.not(hasAudiobook), eb.not(hasAligned)])
      default:
        return eb.lit(false)
    }
  }

  switch (operator) {
    case "is":
      return mediaTypeCondition(String(value))

    case "isNot":
      return eb.not(mediaTypeCondition(String(value)))

    case "isAnyOf":
      if (!Array.isArray(value)) return eb.lit(true)
      return eb.or(value.map((v) => mediaTypeCondition(String(v))))

    case "isNoneOf":
      if (!Array.isArray(value)) return eb.lit(true)
      return eb.and(value.map((v) => eb.not(mediaTypeCondition(String(v)))))

    default:
      return eb.lit(true)
  }
}
