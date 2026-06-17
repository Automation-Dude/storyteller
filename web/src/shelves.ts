import { z } from "zod"

// ---------------------------------------------------------------------------
// fields + operators
// ---------------------------------------------------------------------------

export const SHELF_FILTER_FIELDS = [
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
  "createdAt",
  "updatedAt",
  // user review text on the book (per-user, from userBookRating.review)
  "review",
  // a single axis of the multidimensional rating; the axis id is carried in the
  // condition's `dimension` property (userBookRating.dimensions)
  "ratingDimension",
  // generic free-text search across title / author / series (future: full text)
  "search",
] as const
export const shelfFilterFieldSchema = z.enum(SHELF_FILTER_FIELDS)

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

// ---------------------------------------------------------------------------
// field / operator classification
//
// these arrays are the single source of truth: they drive both the strict zod
// schema below (so the generated json schema ties each field group to the
// operators and value shape it actually supports) and the editor helpers.
// ---------------------------------------------------------------------------

export const STRING_FIELDS = [
  "title",
  "subtitle",
  "description",
  "language",
] as const satisfies readonly ShelfFilterField[]

export const DATE_FIELDS = [
  "publicationDate",
  "createdAt",
  "updatedAt",
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

// fields that support isEmpty / isNotEmpty. mediaType, search and
// ratingDimension are handled separately (ratingDimension carries `dimension`).
export const EMPTINESS_FIELDS = [
  ...STRING_FIELDS,
  ...NUMBER_FIELDS,
  ...DATE_FIELDS,
  ...UUID_FIELDS,
  ...ARRAY_FIELDS,
  "review",
] as const satisfies readonly ShelfFilterField[]

// operators grouped by value arity, so each condition variant can pin field ->
// operator -> value together.
export const TEXT_MATCH_OPERATORS = [
  "is",
  "isNot",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
] as const

export const TEXT_LIST_OPERATORS = ["isAnyOf", "isNoneOf"] as const

export const NUMBER_COMPARE_OPERATORS = [
  "is",
  "isNot",
  "greaterThan",
  "lessThan",
  "greaterOrEqual",
  "lessOrEqual",
] as const

export const RANGE_OPERATORS = ["between"] as const

export const DATE_COMPARE_OPERATORS = [
  "is",
  "isNot",
  "before",
  "after",
] as const

export const UUID_MATCH_OPERATORS = ["is", "isNot"] as const
export const UUID_LIST_OPERATORS = ["isAnyOf", "isNoneOf"] as const

export const ARRAY_OPERATORS = ["includes", "includesAll", "excludes"] as const

export const ENUM_MATCH_OPERATORS = ["is", "isNot"] as const
export const ENUM_LIST_OPERATORS = ["isAnyOf", "isNoneOf"] as const

export const SEARCH_OPERATORS = ["contains"] as const

export const UNARY_OPERATORS = ["isEmpty", "isNotEmpty"] as const

export const OPERATORS_BY_FIELD_TYPE = {
  string: [...TEXT_MATCH_OPERATORS, ...TEXT_LIST_OPERATORS, ...UNARY_OPERATORS],
  number: [...NUMBER_COMPARE_OPERATORS, ...RANGE_OPERATORS, ...UNARY_OPERATORS],
  date: [...DATE_COMPARE_OPERATORS, ...RANGE_OPERATORS, ...UNARY_OPERATORS],
  uuid: [...UUID_MATCH_OPERATORS, ...UUID_LIST_OPERATORS, ...UNARY_OPERATORS],
  array: [...ARRAY_OPERATORS, ...UNARY_OPERATORS],
  enum: [...ENUM_MATCH_OPERATORS, ...ENUM_LIST_OPERATORS],
} as const satisfies Record<
  "string" | "number" | "date" | "uuid" | "array" | "enum",
  ShelfFilterOperator[]
>

export type NumberOperators = (typeof OPERATORS_BY_FIELD_TYPE)["number"][number]
export type DateOperators = (typeof OPERATORS_BY_FIELD_TYPE)["date"][number]
export type UUIDOperators = (typeof OPERATORS_BY_FIELD_TYPE)["uuid"][number]
export type ArrayOperators = (typeof OPERATORS_BY_FIELD_TYPE)["array"][number]
export type EnumOperators = (typeof OPERATORS_BY_FIELD_TYPE)["enum"][number]

// ---------------------------------------------------------------------------
// value + condition schemas (strict)
// ---------------------------------------------------------------------------

export const shelfFilterValueSchema = z.union([
  z.string(),
  z.number(),
  z.array(z.union([z.string(), z.number()])),
  z.tuple([z.string(), z.string()]),
  z.tuple([z.number(), z.number()]),
  z.null(),
])

export type ShelfFilterValue = z.infer<typeof shelfFilterValueSchema>

const TYPE = z.literal("condition")

// one strict variant per (field group x operator arity). each branch in the
// generated json schema therefore constrains operator and value to what the
// field actually supports.
const stringMatchCondition = z
  .object({
    type: TYPE,
    field: z.enum(STRING_FIELDS),
    operator: z.enum(TEXT_MATCH_OPERATORS),
    value: z.string().describe("the text to match against the field"),
  })
  .describe("text match on a string field (title, subtitle, ...)")

const stringListCondition = z
  .object({
    type: TYPE,
    field: z.enum(STRING_FIELDS),
    operator: z.enum(TEXT_LIST_OPERATORS),
    value: z.array(z.string()).describe("the set of candidate values"),
  })
  .describe("membership test on a string field (is any of / is none of)")

const numberCompareCondition = z
  .object({
    type: TYPE,
    field: z.enum(NUMBER_FIELDS),
    operator: z.enum(NUMBER_COMPARE_OPERATORS),
    value: z.number().describe("the number to compare against"),
  })
  .describe("scalar comparison on a numeric field")

const numberRangeCondition = z
  .object({
    type: TYPE,
    field: z.enum(NUMBER_FIELDS),
    operator: z.enum(RANGE_OPERATORS),
    value: z
      .tuple([z.number(), z.number()])
      .describe("inclusive [min, max] range"),
  })
  .describe("range (between) on a numeric field")

const dateCompareCondition = z
  .object({
    type: TYPE,
    field: z.enum(DATE_FIELDS),
    operator: z.enum(DATE_COMPARE_OPERATORS),
    value: z.string().describe("an ISO date string"),
  })
  .describe("scalar comparison on a date field")

const dateRangeCondition = z
  .object({
    type: TYPE,
    field: z.enum(DATE_FIELDS),
    operator: z.enum(RANGE_OPERATORS),
    value: z
      .tuple([z.string(), z.string()])
      .describe("inclusive [from, to] ISO date range"),
  })
  .describe("range (between) on a date field")

const uuidMatchCondition = z
  .object({
    type: TYPE,
    field: z.enum(UUID_FIELDS),
    operator: z.enum(UUID_MATCH_OPERATORS),
    value: z.string().describe("the entity uuid"),
  })
  .describe("scalar match on a uuid field (reading status)")

const uuidListCondition = z
  .object({
    type: TYPE,
    field: z.enum(UUID_FIELDS),
    operator: z.enum(UUID_LIST_OPERATORS),
    value: z.array(z.string()).describe("a set of entity uuids"),
  })
  .describe("membership test on a uuid field")

const arrayCondition = z
  .object({
    type: TYPE,
    field: z.enum(ARRAY_FIELDS),
    operator: z.enum(ARRAY_OPERATORS),
    value: z.array(z.string()).describe("the related entity uuids"),
  })
  .describe("relation membership (tags, collections, series, creators)")

const enumMatchCondition = z
  .object({
    type: TYPE,
    field: z.enum(ENUM_FIELDS),
    operator: z.enum(ENUM_MATCH_OPERATORS),
    value: z.enum(MEDIA_TYPE_VALUES).describe("the media type"),
  })
  .describe("scalar match on the media type")

const enumListCondition = z
  .object({
    type: TYPE,
    field: z.enum(ENUM_FIELDS),
    operator: z.enum(ENUM_LIST_OPERATORS),
    value: z.array(z.enum(MEDIA_TYPE_VALUES)).describe("a set of media types"),
  })
  .describe("membership test on the media type")

const reviewCondition = z
  .object({
    type: TYPE,
    field: z.literal("review"),
    operator: z.enum(TEXT_MATCH_OPERATORS),
    value: z.string().describe("text to match in the user's review"),
  })
  .describe("text match on the user's review")

const ratingDimensionScalarCondition = z
  .object({
    type: TYPE,
    field: z.literal("ratingDimension"),
    dimension: z
      .string()
      .describe(
        "the rating axis id, e.g. plot or prose (see user preferences)",
      ),
    operator: z.enum(NUMBER_COMPARE_OPERATORS),
    value: z.number().describe("the score (0-5) to compare against"),
  })
  .describe("scalar comparison on one multidimensional rating axis")

const ratingDimensionRangeCondition = z
  .object({
    type: TYPE,
    field: z.literal("ratingDimension"),
    dimension: z
      .string()
      .describe(
        "the rating axis id, e.g. plot or prose (see user preferences)",
      ),
    operator: z.enum(RANGE_OPERATORS),
    value: z.tuple([z.number(), z.number()]).describe("inclusive [min, max]"),
  })
  .describe("range (between) on one multidimensional rating axis")

const ratingDimensionUnaryCondition = z
  .object({
    type: TYPE,
    field: z.literal("ratingDimension"),
    dimension: z.string().describe("the rating axis id"),
    operator: z.enum(UNARY_OPERATORS),
  })
  .describe("presence test on one multidimensional rating axis")

const searchCondition = z
  .object({
    type: TYPE,
    field: z.literal("search"),
    operator: z.enum(SEARCH_OPERATORS),
    value: z
      .string()
      .describe("free-text query matched against title/author/series"),
  })
  .describe("generic free-text search across the book")

const unaryCondition = z
  .object({
    type: TYPE,
    field: z.enum(EMPTINESS_FIELDS),
    operator: z.enum(UNARY_OPERATORS),
  })
  .describe("presence test (is empty / is not empty)")

const conditionVariants = z.union([
  stringMatchCondition,
  stringListCondition,
  numberCompareCondition,
  numberRangeCondition,
  dateCompareCondition,
  dateRangeCondition,
  uuidMatchCondition,
  uuidListCondition,
  arrayCondition,
  enumMatchCondition,
  enumListCondition,
  reviewCondition,
  ratingDimensionScalarCondition,
  ratingDimensionRangeCondition,
  ratingDimensionUnaryCondition,
  searchCondition,
  unaryCondition,
])

// unary operators take no value; tolerate legacy conditions that still carry an
// empty value by stripping it before matching the strict variants above.
export const shelfFilterConditionSchema = z.preprocess((val) => {
  if (
    val &&
    typeof val === "object" &&
    "operator" in val &&
    (val.operator === "isEmpty" || val.operator === "isNotEmpty") &&
    "value" in val
  ) {
    const { value: _omit, ...rest } = val as Record<string, unknown>
    return rest
  }
  return val
}, conditionVariants)

// the in-memory condition the editor manipulates is intentionally loose; the
// strict schema above is the validation boundary (routes + generated json
// schema). value is optional (absent for unary), dimension only for
// ratingDimension.
export type ShelfFilterCondition = {
  type: "condition"
  field: ShelfFilterField
  operator: ShelfFilterOperator
  value?: ShelfFilterValue
  dimension?: string
}

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
  z.union([
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
// the root of a shelf filter is always a logical block (and / or / not); a bare
// condition is not a valid top-level filter. conditions only live as children.

export const shelfFilterRootSchema = z.discriminatedUnion("type", [
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
])

export const shelfFilterSchema = shelfFilterRootSchema

// ---------------------------------------------------------------------------
// labels + editor helpers
// ---------------------------------------------------------------------------

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
  createdAt: "Date Added",
  updatedAt: "Date Updated",
  review: "My Review",
  ratingDimension: "Rating Dimension",
  search: "Search (any field)",
}

export function getFieldType(
  field: ShelfFilterField,
): "string" | "number" | "date" | "uuid" | "array" | "enum" {
  // review / search render as text; a single rating axis renders as a number.
  if (field === "review" || field === "search") return "string"
  if (field === "ratingDimension") return "number"
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
  // the special fields don't follow the plain field-type operator sets: review
  // is text-match only (no any-of), a rating axis is numeric, search is a single
  // contains.
  if (field === "review") {
    return [...TEXT_MATCH_OPERATORS, ...UNARY_OPERATORS]
  }
  if (field === "ratingDimension") {
    return [...NUMBER_COMPARE_OPERATORS, ...RANGE_OPERATORS, ...UNARY_OPERATORS]
  }
  if (field === "search") {
    return [...SEARCH_OPERATORS]
  }

  const fieldType = getFieldType(field)
  return [...OPERATORS_BY_FIELD_TYPE[fieldType]]
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
// the default filter the editor starts from: an `and` block holding a single
// blank condition, ready to fill in or add siblings to.

export function createDefaultFilter(): ShelfFilterAnd {
  return createAndBlock()
}
// coerce any stored filter to the root rule: a logical block. a bare condition
// gets wrapped in an `and`; a missing filter becomes the default block.

export function normalizeRootFilter(
  node: ShelfFilterNode | null,
): ShelfFilterAnd | ShelfFilterOr | ShelfFilterNot {
  if (!node) return createDefaultFilter()
  if (node.type === "condition") return createAndBlock([node])
  return node
}

export const ShelfOrderBy = [
  "createdAt",
  "updatedAt",
  "title",
  "publicationDate",
  "rating",
  "position",
] as const

export type ShelfOrderBy = (typeof ShelfOrderBy)[number]

export const HomeSectionKind = [
  "hero",
  "stats",
  "currentlyReading",
  "nextUpInSeries",
  "recentlyAdded",
  "custom",
] as const

export type HomeSectionKind = (typeof HomeSectionKind)[number]
