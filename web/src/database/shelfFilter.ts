import {
  type ExpressionBuilder,
  type ExpressionWrapper,
  type SqlBool,
  sql,
} from "kysely"
import { z } from "zod"

import { type UUID } from "@/uuid"

import { type DB } from "./schema"

// ---------------------------------------------------------------------------
// zod schemas
// ---------------------------------------------------------------------------

export const shelfFilterFieldSchema = z.enum([
  "title",
  "subtitle",
  "description",
  "language",
  "publicationDate",
  "rating",
  "userRating",
  "duration",
  "pageCount",
  "fileSize",
  "status",
  "tags",
  "collections",
  "series",
  "creators",
  "mediaType",
])

export type ShelfFilterField = z.infer<typeof shelfFilterFieldSchema>

export const shelfFilterOperatorSchema = z.enum([
  "is",
  "isNot",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
  "greaterThan",
  "lessThan",
  "greaterOrEqual",
  "lessOrEqual",
  "between",
  "before",
  "after",
  "includes",
  "includesAll",
  "excludes",
  "isAnyOf",
  "isNoneOf",
  "isEmpty",
  "isNotEmpty",
])

export type ShelfFilterOperator = z.infer<typeof shelfFilterOperatorSchema>

export const shelfFilterValueSchema = z.union([
  z.string(),
  z.number(),
  z.array(z.union([z.string(), z.number()])),
  z.tuple([z.string(), z.string()]),
  z.tuple([z.number(), z.number()]),
  z.null(),
])

export type ShelfFilterValue = z.infer<typeof shelfFilterValueSchema>

export const shelfFilterConditionSchema = z.object({
  type: z.literal("condition"),
  field: shelfFilterFieldSchema,
  operator: shelfFilterOperatorSchema,
  value: shelfFilterValueSchema.optional(),
})

export type ShelfFilterCondition = z.infer<typeof shelfFilterConditionSchema>

export type ShelfFilterAnd = {
  type: "and"
  children: ShelfFilterNode[]
}

export type ShelfFilterOr = {
  type: "or"
  children: ShelfFilterNode[]
}

export type ShelfFilterNot = {
  type: "not"
  child: ShelfFilterNode
}

export type ShelfFilterNode =
  | ShelfFilterCondition
  | ShelfFilterAnd
  | ShelfFilterOr
  | ShelfFilterNot

export type ShelfFilter = ShelfFilterNode

export const shelfFilterNodeSchema: z.ZodType<ShelfFilterNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    shelfFilterConditionSchema,
    z.object({
      type: z.literal("and"),
      children: z.array(shelfFilterNodeSchema),
    }),
    z.object({
      type: z.literal("or"),
      children: z.array(shelfFilterNodeSchema),
    }),
    z.object({
      type: z.literal("not"),
      child: shelfFilterNodeSchema,
    }),
  ]),
)

export const shelfFilterSchema = shelfFilterNodeSchema

// ---------------------------------------------------------------------------
// field / operator classification
// ---------------------------------------------------------------------------

export const STRING_FIELDS = [
  "title",
  "subtitle",
  "description",
  "language",
] as const satisfies readonly ShelfFilterField[]

export const DATE_FIELDS = [
  "publicationDate",
] as const satisfies readonly ShelfFilterField[]

export const NUMBER_FIELDS = [
  "rating",
  "userRating",
  "duration",
  "pageCount",
  "fileSize",
] as const satisfies readonly ShelfFilterField[]

export const UUID_FIELDS = [
  "status",
] as const satisfies readonly ShelfFilterField[]

export const ARRAY_FIELDS = [
  "tags",
  "collections",
  "series",
  "creators",
] as const satisfies readonly ShelfFilterField[]

export const ENUM_FIELDS = [
  "mediaType",
] as const satisfies readonly ShelfFilterField[]

export const MEDIA_TYPE_VALUES = ["ebook", "audiobook", "synced"] as const

export const OPERATORS_BY_FIELD_TYPE = {
  string: [
    "is",
    "isNot",
    "contains",
    "notContains",
    "startsWith",
    "endsWith",
    "isAnyOf",
    "isNoneOf",
    "isEmpty",
    "isNotEmpty",
  ],
  number: [
    "is",
    "isNot",
    "greaterThan",
    "lessThan",
    "greaterOrEqual",
    "lessOrEqual",
    "between",
    "isEmpty",
    "isNotEmpty",
  ],
  date: ["is", "isNot", "before", "after", "between", "isEmpty", "isNotEmpty"],
  uuid: ["is", "isNot", "isAnyOf", "isNoneOf", "isEmpty", "isNotEmpty"],
  array: ["includes", "includesAll", "excludes", "isEmpty", "isNotEmpty"],
  enum: ["is", "isNot", "isAnyOf", "isNoneOf"],
} as const satisfies Record<
  "string" | "number" | "date" | "uuid" | "array" | "enum",
  ShelfFilterOperator[]
>

export type NumberOperators = (typeof OPERATORS_BY_FIELD_TYPE)["number"][number]
export type DateOperators = (typeof OPERATORS_BY_FIELD_TYPE)["date"][number]
export type UUIDOperators = (typeof OPERATORS_BY_FIELD_TYPE)["uuid"][number]
export type ArrayOperators = (typeof OPERATORS_BY_FIELD_TYPE)["array"][number]
export type EnumOperators = (typeof OPERATORS_BY_FIELD_TYPE)["enum"][number]

export const OPERATOR_LABELS: Record<ShelfFilterOperator, string> = {
  is: "is",
  isNot: "is not",
  contains: "contains",
  notContains: "does not contain",
  startsWith: "starts with",
  endsWith: "ends with",
  greaterThan: "greater than",
  lessThan: "less than",
  greaterOrEqual: "at least",
  lessOrEqual: "at most",
  between: "between",
  before: "before",
  after: "after",
  includes: "includes any of",
  includesAll: "includes all of",
  excludes: "excludes",
  isAnyOf: "is any of",
  isNoneOf: "is none of",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
}

export const FIELD_LABELS: Record<ShelfFilterField, string> = {
  title: "Title",
  subtitle: "Subtitle",
  description: "Description",
  language: "Language",
  publicationDate: "Publication Date",
  rating: "Rating (book)",
  userRating: "My Rating",
  duration: "Duration",
  pageCount: "Page Count",
  fileSize: "File Size",
  status: "Reading Status",
  tags: "Tags",
  collections: "Collections",
  series: "Series",
  creators: "Authors / Creators",
  mediaType: "Media Type",
}

export function getFieldType(
  field: ShelfFilterField,
): "string" | "number" | "date" | "uuid" | "array" | "enum" {
  if ((STRING_FIELDS as readonly string[]).includes(field)) return "string"
  if ((NUMBER_FIELDS as readonly string[]).includes(field)) return "number"
  if ((DATE_FIELDS as readonly string[]).includes(field)) return "date"
  if ((UUID_FIELDS as readonly string[]).includes(field)) return "uuid"
  if ((ARRAY_FIELDS as readonly string[]).includes(field)) return "array"
  return "enum"
}

export function getOperatorsForField(
  field: ShelfFilterField,
): ShelfFilterOperator[] {
  const fieldType = getFieldType(field)
  return OPERATORS_BY_FIELD_TYPE[fieldType]
}

export function operatorRequiresValue(operator: ShelfFilterOperator): boolean {
  return operator !== "isEmpty" && operator !== "isNotEmpty"
}

export function operatorRequiresArrayValue(
  operator: ShelfFilterOperator,
): boolean {
  return (
    operator === "isAnyOf" ||
    operator === "isNoneOf" ||
    operator === "includes" ||
    operator === "includesAll" ||
    operator === "excludes"
  )
}

export function operatorRequiresRangeValue(
  operator: ShelfFilterOperator,
): boolean {
  return operator === "between"
}

export function createEmptyCondition(): ShelfFilterCondition {
  return {
    type: "condition",
    field: "title",
    operator: "contains",
    value: "",
  }
}

export function createAndBlock(
  children: ShelfFilterNode[] = [createEmptyCondition()],
): ShelfFilterAnd {
  return { type: "and", children }
}

export function createOrBlock(
  children: ShelfFilterNode[] = [createEmptyCondition()],
): ShelfFilterOr {
  return { type: "or", children }
}

export function createNotBlock(
  child: ShelfFilterNode = createEmptyCondition(),
): ShelfFilterNot {
  return { type: "not", child }
}

export function isLogicalBlock(
  node: ShelfFilterNode,
): node is ShelfFilterAnd | ShelfFilterOr | ShelfFilterNot {
  return node.type === "and" || node.type === "or" || node.type === "not"
}

export function extractEntityReferences(filter: ShelfFilter): Array<{
  entityType: "tag" | "collection" | "series" | "status" | "creator"
  entityUuid: string
}> {
  const refs: Array<{
    entityType: "tag" | "collection" | "series" | "status" | "creator"
    entityUuid: string
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
          refs.push({ entityType, entityUuid: v })
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

function buildConditionExpression(
  eb: EB,
  condition: ShelfFilterCondition,
  userId?: UUID,
): FilterExpression {
  const { field, operator, value } = condition

  if (operator === "isEmpty") {
    return buildIsEmptyExpression(eb, field, userId)
  }

  if (operator === "isNotEmpty") {
    return eb.not(buildIsEmptyExpression(eb, field, userId))
  }

  if (value === undefined || value === null) {
    return eb.lit(true)
  }

  return buildComparisonExpression(eb, field, operator, value, userId)
}

function buildIsEmptyExpression(
  eb: EB,
  field: ShelfFilterField,
  userId?: UUID,
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

    case "rating":
      return eb("book.rating", "is", null)

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
      return eb("book.duration", "is", null)

    case "pageCount":
      return eb("book.pageCount", "is", null)

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
            .whereRef("bookToCreator.bookUuid", "=", "book.uuid"),
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
  field: ShelfFilterField,
  operator: ShelfFilterOperator,
  value: ShelfFilterValue,
  userId?: UUID,
): FilterExpression {
  const fieldType = getFieldType(field)

  if (field === "userRating") {
    return buildUserRatingComparison(eb, operator, value, userId)
  }

  if (field === "fileSize") {
    return buildFileSizeComparison(eb, operator, value)
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
      return buildNumberComparison(
        eb,
        field as "rating" | "duration" | "pageCount",
        operator,
        value,
      )
    case "date":
      return buildDateComparison(
        eb,
        field as "publicationDate",
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

function buildNumberComparison(
  eb: EB,
  field: "rating" | "duration" | "pageCount",
  operator: ShelfFilterOperator,
  value: ShelfFilterValue,
): FilterExpression {
  const column = `book.${field}` as const

  switch (operator) {
    case "is":
      return eb(column, "=", Number(value))

    case "isNot":
      return eb(column, "!=", Number(value))

    case "greaterThan":
      return eb(column, ">", Number(value))

    case "lessThan":
      return eb(column, "<", Number(value))

    case "greaterOrEqual":
      return eb(column, ">=", Number(value))

    case "lessOrEqual":
      return eb(column, "<=", Number(value))

    case "between":
      if (!Array.isArray(value) || value.length !== 2) return eb.lit(true)
      return eb.and([
        eb(column, ">=", Number(value[0])),
        eb(column, "<=", Number(value[1])),
      ])

    default: {
      const _exhaustive: Exclude<
        typeof operator,
        Exclude<NumberOperators, "isEmpty" | "isNotEmpty">
      > = operator
      return eb.lit(true)
    }
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

function buildFileSizeComparison(
  eb: EB,
  operator: ShelfFilterOperator,
  value: ShelfFilterValue,
): FilterExpression {
  // file size is the max across ebook and audiobook assets
  const fileSizeExpr = sql<number>`coalesce(
    (select max(e.file_size) from ebook e where e.book_uuid = book.uuid),
    (select max(a.file_size) from audiobook a where a.book_uuid = book.uuid),
    0
  )`

  switch (operator) {
    case "is":
      return eb(fileSizeExpr, "=", Number(value))

    case "isNot":
      return eb(fileSizeExpr, "!=", Number(value))

    case "greaterThan":
      return eb(fileSizeExpr, ">", Number(value))

    case "lessThan":
      return eb(fileSizeExpr, "<", Number(value))

    case "greaterOrEqual":
      return eb(fileSizeExpr, ">=", Number(value))

    case "lessOrEqual":
      return eb(fileSizeExpr, "<=", Number(value))

    case "between":
      if (!Array.isArray(value) || value.length !== 2) return eb.lit(true)
      return eb.and([
        eb(fileSizeExpr, ">=", Number(value[0])),
        eb(fileSizeExpr, "<=", Number(value[1])),
      ])

    default:
      return eb.lit(true)
  }
}

function buildDateComparison(
  eb: EB,
  field: "publicationDate",
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
      return buildCreatorComparison(eb, operator, uuids)
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
): FilterExpression {
  switch (operator) {
    case "includes":
      return eb.exists(
        eb
          .selectFrom("bookToCreator")
          .select(sql.lit(1).as("one"))
          .whereRef("bookToCreator.bookUuid", "=", "book.uuid")
          .where("bookToCreator.creatorUuid", "in", uuids),
      )

    case "includesAll":
      return eb.and(
        uuids.map((uuid) =>
          eb.exists(
            eb
              .selectFrom("bookToCreator")
              .select(sql.lit(1).as("one"))
              .whereRef("bookToCreator.bookUuid", "=", "book.uuid")
              .where("bookToCreator.creatorUuid", "=", uuid),
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
            .where("bookToCreator.creatorUuid", "in", uuids),
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
  const mediaTypeCondition = (type: string): FilterExpression => {
    switch (type) {
      case "ebook":
        return eb.and([
          eb.exists(
            eb
              .selectFrom("ebook")
              .select(sql.lit(1).as("one"))
              .whereRef("ebook.bookUuid", "=", "book.uuid"),
          ),
          eb.not(
            eb.exists(
              eb
                .selectFrom("audiobook")
                .select(sql.lit(1).as("one"))
                .whereRef("audiobook.bookUuid", "=", "book.uuid"),
            ),
          ),
        ])

      case "audiobook":
        return eb.and([
          eb.exists(
            eb
              .selectFrom("audiobook")
              .select(sql.lit(1).as("one"))
              .whereRef("audiobook.bookUuid", "=", "book.uuid"),
          ),
          eb.not(
            eb.exists(
              eb
                .selectFrom("ebook")
                .select(sql.lit(1).as("one"))
                .whereRef("ebook.bookUuid", "=", "book.uuid"),
            ),
          ),
        ])

      case "synced":
        return eb.or([
          eb.exists(
            eb
              .selectFrom("readaloud")
              .select(sql.lit(1).as("one"))
              .whereRef("readaloud.bookUuid", "=", "book.uuid")
              .where("readaloud.status", "=", "ALIGNED"),
          ),
          eb.and([
            eb.exists(
              eb
                .selectFrom("ebook")
                .select(sql.lit(1).as("one"))
                .whereRef("ebook.bookUuid", "=", "book.uuid"),
            ),
            eb.exists(
              eb
                .selectFrom("audiobook")
                .select(sql.lit(1).as("one"))
                .whereRef("audiobook.bookUuid", "=", "book.uuid"),
            ),
          ]),
        ])

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
