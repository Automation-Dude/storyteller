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
  // when the book's read-along alignment last completed (book.alignedAt)
  "alignedAt",
  // denormalized alignment quality columns on book (see summarizeReport)
  "alignmentGrade",
  "alignmentScore",
  "alignmentMissingSentences",
  "alignmentMutedChapters",
  // per-user reading progress, derived from the position table: lastRead is
  // position.timestamp, readingPosition is the locator's total progression (0-1)
  "lastRead",
  "readingPosition",
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
  // a short grade string (A+ .. F); is / is-any-of are the useful operators.
  "alignmentGrade",
] as const satisfies readonly ShelfFilterField[]

export const DATE_FIELDS = [
  "publicationDate",
  "createdAt",
  "updatedAt",
  "alignedAt",
  // per-user, derived from position.timestamp (see shelfFilter.ts)
  "lastRead",
] as const satisfies readonly ShelfFilterField[]

export const NUMBER_FIELDS = [
  "userRating",
  "duration",
  "pageCount",
  "fileSize",
  "alignmentScore",
  "alignmentMissingSentences",
  "alignmentMutedChapters",
  // per-user, locator total progression 0-1 (see shelfFilter.ts)
  "readingPosition",
] as const satisfies readonly ShelfFilterField[]

// the asset a format-scoped numeric (fileSize / duration / pageCount) targets.
// absent = the cross-format fallback (assetNumericExpr coalesce). mirrors the
// `role` discriminator on creator conditions.
export const ASSET_FORMATS = ["ebook", "audiobook", "readaloud"] as const
export type AssetFormat = (typeof ASSET_FORMATS)[number]

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

// the "Format" filter. the first three are broad (has-ebook / has-audiobook /
// has-aligned-readaloud); the rest are composites mirroring getFormatKey so a
// user can ask for e.g. "audiobook only" or "ebook+audiobook but not synced".
export const MEDIA_TYPE_VALUES = [
  "ebook",
  "audiobook",
  "synced",
  "ebook-only",
  "audiobook-only",
  "missing-readaloud",
  "no-media",
] as const

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
    field: z.enum(EMPTINESS_FIELDS),
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

// unary operators take no value; tolerate legacy conditions that still carry an
// empty value by stripping it before matching the strict variants above.
export const shelfFilterConditionSchema = z.preprocess((val) => {
  if (!val || typeof val !== "object") return val
  let obj = val as Record<string, unknown>

  // the aggregate book `rating` field was removed; only the user's own rating
  // remains. map any legacy saved condition onto userRating so it still loads.
  if (obj["field"] === "rating") {
    obj = { ...obj, field: "userRating" }
  }

  // unary operators take no value; tolerate legacy conditions that still carry
  // an empty value by stripping it before matching the strict variants above.
  const op = obj["operator"]
  if ((op === "isEmpty" || op === "isNotEmpty") && "value" in obj) {
    const { value: _omit, ...rest } = obj
    return rest
  }

  return obj
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
  // only meaningful when field is "creators": scopes the match to a single marc
  // relator role (aut / nrt / trl). absent = any role.
  role?: string
  // only meaningful for fileSize / duration / pageCount: scopes the numeric to
  // one asset format. absent = the cross-format fallback.
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

export const shelfFilterSchema = z.union([shelfFilterRootSchema])

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

// ---------------------------------------------------------------------------
// field registry
//
// one entry per field describing everything the ui needs to know about it:
// which value control to render, whether it can be sorted, whether it shows in
// the quick "Add filter" menu, where to fetch its options (facets), display
// hints, an optional per-condition discriminator (role / format), and the
// future search-query token. labels are NOT here - they live in the i18n
// `Fields.label` / `Fields.short` namespaces keyed by `labelKey` - so copy stays
// in one place. the per-field operator set still comes from
// getOperatorsForField, and the value type from getFieldType; this registry is
// the single source for the *ui + sort + serialization* metadata that was
// previously scattered across BookFilters, use-book-filters, sort.ts and the
// editor.
// ---------------------------------------------------------------------------

export type FieldControl =
  | "text"
  | "number-range"
  | "date-range"
  | "duration-range"
  | "facet"
  | "format-enum"

export type FacetSource =
  | "tags"
  | "collections"
  | "series"
  | "creators"
  | "statuses"

export type FieldScale = {
  min?: number
  max?: number
  step?: number
  unit?: "bytes" | "seconds" | "count" | "ratio" | "year"
}

export type FieldDef = {
  control: FieldControl
  // member of the sort menu (the registry is the source of truth for the
  // sortable set; seriesPosition is the one sort that is not a filter field and
  // is added in sort.ts).
  sortable: boolean
  // member of the quick "Add filter" menu (the advanced editor offers all).
  quick: boolean
  // facet fields: the list endpoint the generic control fetches options from.
  source?: FacetSource
  // numeric / date display hints (slider bounds, year vs full date, unit).
  scale?: FieldScale
  // an extra per-condition discriminator the control must collect: creators ->
  // role, asset numerics -> format.
  discriminator?: "role" | "format"
  // the future search-query token (e.g. tag:foo). carried now so the parser /
  // url codec in a later pass reads it from one place.
  token: string
  // key under the i18n `Fields.label` / `Fields.short` namespaces.
  labelKey: string
}

export const FIELD_REGISTRY: Record<ShelfFilterField, FieldDef> = {
  // -- text -----------------------------------------------------------------
  title: {
    control: "text",
    sortable: true,
    quick: false,
    token: "title",
    labelKey: "title",
  },
  subtitle: {
    control: "text",
    sortable: false,
    quick: false,
    token: "subtitle",
    labelKey: "subtitle",
  },
  description: {
    control: "text",
    sortable: false,
    quick: false,
    token: "description",
    labelKey: "description",
  },
  language: {
    control: "text",
    sortable: true,
    quick: false,
    token: "language",
    labelKey: "language",
  },
  review: {
    control: "text",
    sortable: false,
    quick: false,
    token: "review",
    labelKey: "review",
  },
  search: {
    control: "text",
    sortable: false,
    quick: false,
    token: "text",
    labelKey: "search",
  },
  alignmentGrade: {
    control: "text",
    sortable: true,
    quick: false,
    token: "grade",
    labelKey: "alignmentGrade",
  },

  // -- facets / enum --------------------------------------------------------
  status: {
    control: "facet",
    sortable: false,
    quick: true,
    source: "statuses",
    token: "status",
    labelKey: "status",
  },
  tags: {
    control: "facet",
    sortable: false,
    quick: true,
    source: "tags",
    token: "tag",
    labelKey: "tags",
  },
  collections: {
    control: "facet",
    sortable: false,
    quick: true,
    source: "collections",
    token: "collection",
    labelKey: "collections",
  },
  series: {
    control: "facet",
    sortable: false,
    quick: true,
    source: "series",
    token: "series",
    labelKey: "series",
  },
  creators: {
    control: "facet",
    sortable: false,
    quick: true,
    source: "creators",
    discriminator: "role",
    token: "author",
    labelKey: "creators",
  },
  mediaType: {
    control: "format-enum",
    sortable: false,
    quick: true,
    token: "format",
    labelKey: "mediaType",
  },

  // -- numeric --------------------------------------------------------------
  userRating: {
    control: "number-range",
    sortable: true,
    quick: true,
    scale: { min: 0, max: 5, step: 1, unit: "count" },
    token: "rating",
    labelKey: "userRating",
  },
  ratingDimension: {
    control: "number-range",
    sortable: false,
    quick: false,
    scale: { min: 0, max: 5, step: 1, unit: "count" },
    token: "axis",
    labelKey: "ratingDimension",
  },
  pageCount: {
    control: "number-range",
    sortable: true,
    quick: true,
    discriminator: "format",
    scale: { min: 0, unit: "count" },
    token: "pages",
    labelKey: "pageCount",
  },
  duration: {
    control: "duration-range",
    sortable: true,
    quick: true,
    discriminator: "format",
    scale: { min: 0, unit: "seconds" },
    token: "duration",
    labelKey: "duration",
  },
  fileSize: {
    control: "number-range",
    sortable: true,
    quick: true,
    discriminator: "format",
    scale: { min: 0, unit: "bytes" },
    token: "size",
    labelKey: "fileSize",
  },
  readingPosition: {
    control: "number-range",
    sortable: false,
    quick: true,
    scale: { min: 0, max: 1, step: 0.01, unit: "ratio" },
    token: "progress",
    labelKey: "readingPosition",
  },
  alignmentScore: {
    control: "number-range",
    sortable: true,
    quick: false,
    scale: { min: 0, max: 100, unit: "count" },
    token: "score",
    labelKey: "alignmentScore",
  },
  alignmentMissingSentences: {
    control: "number-range",
    sortable: true,
    quick: false,
    scale: { min: 0, unit: "count" },
    token: "missing",
    labelKey: "alignmentMissingSentences",
  },
  alignmentMutedChapters: {
    control: "number-range",
    sortable: true,
    quick: false,
    scale: { min: 0, unit: "count" },
    token: "muted",
    labelKey: "alignmentMutedChapters",
  },

  // -- dates ----------------------------------------------------------------
  publicationDate: {
    control: "date-range",
    sortable: true,
    quick: true,
    scale: { unit: "year" },
    token: "published",
    labelKey: "publicationDate",
  },
  createdAt: {
    control: "date-range",
    sortable: true,
    quick: true,
    token: "added",
    labelKey: "createdAt",
  },
  updatedAt: {
    control: "date-range",
    sortable: true,
    quick: false,
    token: "updated",
    labelKey: "updatedAt",
  },
  alignedAt: {
    control: "date-range",
    sortable: true,
    quick: true,
    token: "aligned",
    labelKey: "alignedAt",
  },
  lastRead: {
    control: "date-range",
    sortable: true,
    quick: true,
    token: "read",
    labelKey: "lastRead",
  },
}

export function getFieldDef(field: ShelfFilterField): FieldDef {
  return FIELD_REGISTRY[field]
}

// the filter fields offered in the quick "Add filter" menu, in registry order.
// TODO: don't make this a function stupid
export function quickFilterFields(): ShelfFilterField[] {
  return (Object.keys(FIELD_REGISTRY) as ShelfFilterField[]).filter(
    (f) => FIELD_REGISTRY[f].quick,
  )
}

// the facet fields (relation/uuid lists fetched from a list endpoint).
export function facetFields(): ShelfFilterField[] {
  return (Object.keys(FIELD_REGISTRY) as ShelfFilterField[]).filter(
    (f) => FIELD_REGISTRY[f].control === "facet",
  )
}

// the sortable filter fields, in registry order. seriesPosition (a context-only
// sort that is not a filter field) is appended in sort.ts.
export function registrySortableFields(): ShelfFilterField[] {
  return (Object.keys(FIELD_REGISTRY) as ShelfFilterField[]).filter(
    (f) => FIELD_REGISTRY[f].sortable,
  )
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

// the operator a freshly-added filter on a field should default to. `is` is
// rarely what you want (slow to fill, often the wrong question); pick the common
// case instead: contains for text, between for numbers/dates, any-of for
// relations/enums.
export function defaultOperatorForField(
  field: ShelfFilterField,
): ShelfFilterOperator {
  if (field === "search" || field === "review") return "contains"

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
