import { z } from "zod"

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
