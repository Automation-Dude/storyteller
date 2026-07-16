// this file contains the shared logic for the shelf filter for the frontend and backend
// for backend only, see database/shelfFilter.ts

import { z } from "zod"

import {
  type ALIGNMENT_GRADES,
  ARRAY_FIELDS,
  ASSET_FORMATS,
  type AssetFormat,
  CAN_BE_EMPTY_FIELDS,
  DATE_FIELDS,
  ENUM_FIELDS,
  FIELDS,
  type FieldType,
  MEDIA_TYPE_VALUES,
  NUMBER_FIELDS,
  STRING_FIELDS,
  UUID_FIELDS,
  getFieldDef,
  getFieldType,
} from "./fields"
import { type RegistrySortField, SORTABLE_FIELDS } from "./sort"

export const shelfFilterFieldSchema = z.enum(FIELDS)

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
} as const satisfies Record<FieldType, ShelfFilterOperator[]>

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
    format: z
      .enum(ASSET_FORMATS)
      .optional()
      .describe(
        "fileSize / duration / pageCount only: scope to one asset format",
      ),
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
    format: z
      .enum(ASSET_FORMATS)
      .optional()
      .describe(
        "fileSize / duration / pageCount only: scope to one asset format",
      ),
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
    role: z
      .string()
      .optional()
      .describe(
        "creators only: scope to a marc relator role (aut / nrt / trl)",
      ),
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
    field: z.enum(CAN_BE_EMPTY_FIELDS),
    operator: z.enum(UNARY_OPERATORS),
    role: z
      .string()
      .optional()
      .describe(
        "creators only: scope to a marc relator role (aut / nrt / trl)",
      ),
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

export const shelfFilterConditionSchema = z.preprocess((val) => {
  if (!val || typeof val !== "object") return val
  let obj = val as Record<string, unknown>

  // we dont look at the main rating field, only the user's rating
  if (obj["field"] === "rating") {
    obj = { ...obj, field: "userRating" }
  }

  const op = obj["operator"]
  if ((op === "isEmpty" || op === "isNotEmpty") && "value" in obj) {
    const { value: _omit, ...rest } = obj
    return rest
  }

  return obj
}, conditionVariants)

export type ShelfFilterCondition = {
  type: "condition"
  field: ShelfFilterField
  operator: ShelfFilterOperator
  value?: ShelfFilterValue
  dimension?: string
  role?: string
  format?: AssetFormat
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

export const shelfFilterSchema = z.union([shelfFilterRootSchema])

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

export function getOperatorsForField(
  field: ShelfFilterField,
): ShelfFilterOperator[] {
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

export function defaultOperatorForField(
  field: ShelfFilterField,
): ShelfFilterOperator {
  if (field === "search" || field === "review") return "contains"

  const registryDefault = getFieldDef(field).defaultOperator
  if (registryDefault) return registryDefault

  switch (getFieldType(field)) {
    case "string":
      return "contains"
    case "number":
    case "date":
      return "between"
    case "array":
      return "includes"
    case "enum":
      return "isAnyOf"
    case "uuid":
      return "is"
  }
}

// the starting value shape for a freshly-added operator, so the condition is
// well-formed (if not yet complete) the moment it appears in the editor.
function initialValueForOperator(
  operator: ShelfFilterOperator,
): ShelfFilterValue | undefined {
  if (!operatorRequiresValue(operator)) return undefined
  if (operatorRequiresArrayValue(operator)) return []
  if (operatorRequiresRangeValue(operator)) return undefined
  return ""
}

export function createEmptyCondition(
  field: ShelfFilterField = "title",
): ShelfFilterCondition {
  const operator = defaultOperatorForField(field)
  return {
    type: "condition",
    field,
    operator,
    value: initialValueForOperator(operator),
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

export function createDefaultFilter(): ShelfFilterAnd {
  return createAndBlock()
}

export function normalizeRootFilter(
  node: ShelfFilterNode | null,
): ShelfFilterAnd | ShelfFilterOr | ShelfFilterNot {
  if (!node) return createDefaultFilter()
  if (node.type === "condition") return createAndBlock([node])
  return node
}

export type ShelfOrderBy = RegistrySortField | "position"

export const SHELF_ORDER_BY_FIELDS = [
  ...SORTABLE_FIELDS,
  "position",
] as unknown as [ShelfOrderBy, ...ShelfOrderBy[]]

export const HomeSectionKind = [
  "hero",
  "stats",
  "currentlyReading",
  "nextUpInSeries",
  "recentlyAdded",
  "custom",
] as const

export type AlignmentGrade = (typeof ALIGNMENT_GRADES)[number]

export type HomeSectionKind = (typeof HomeSectionKind)[number]
