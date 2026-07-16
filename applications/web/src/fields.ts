import { type AcceptedKeys } from "./app/(v3)/v3/_/lib/mapping"
import { type ShelfFilterOperator } from "./shelves"

export type FieldGroupKey =
  | "text"
  | "dates"
  | "review"
  | "relations"
  | "media"
  | "alignment"
  | "creators"

export type FieldControl =
  | "text"
  | "number-range"
  | "date-range"
  | "duration-range"
  | "facet"
  | "enum"

export type FacetSource =
  | "tags"
  | "collections"
  | "series"
  | "statuses"
  | "authors"
  | "narrators"
  | "translators"
  | "creators"
  // the distinct stored values of the field's own book column (language,
  // transcription engine, ...), fetched via the generic distinct endpoint
  | "distinct"

export type FieldScale = {
  min?: number
  max?: number
  step?: number
  unit?: "bytes" | "seconds" | "count" | "ratio" | "year"
}
export type FieldType = "string" | "number" | "date" | "uuid" | "array" | "enum"

export type FieldDefBase = {
  sortable: boolean
  defaultSort?: "asc" | "desc"
  quick: boolean
  token: string
  labelKey: string
  group: FieldGroupKey
  type: FieldType
  extraOperators?: ShelfFilterOperator[]
  defaultOperator?: ShelfFilterOperator
}

export type FieldDefText = FieldDefBase & {
  control: "text"
}

export type FieldDefFacet = FieldDefBase & {
  control: "facet"
  source: FacetSource
  discriminator?: "role"
}

export type FieldDefEnum = FieldDefBase & {
  control: "enum"
  options: string[]
  discriminator?: "format"
}

export type FieldDefNumeric = FieldDefBase & {
  control: "number-range"
  scale?: FieldScale
  discriminator?: "role" | "format"
  options?: { min: number; max: number; label: string }[]
  formats?: AssetFormat[]
}

export type FieldDefDate = FieldDefBase & {
  control: "date-range"
  scale?: FieldScale
  discriminator?: "format"
  presets?: DatePreset[]
}

export type FieldDefDuration = FieldDefBase & {
  control: "duration-range"
  scale: FieldScale
  discriminator?: "format"
  options?: { min: number; max: number; label: string }[]
  formats?: AssetFormat[]
}

export type FieldDef =
  | FieldDefFacet
  | FieldDefEnum
  | FieldDefNumeric
  | FieldDefDate
  | FieldDefDuration
  | FieldDefText
export const ALIGNMENT_GRADES = [
  "A+",
  "A",
  "A-",
  "B",
  "B-",
  "C",
  "D",
  "F",
] as const

export const ASSET_FORMATS = ["ebook", "audiobook", "readaloud"] as const
export type AssetFormat = (typeof ASSET_FORMATS)[number]

export type DatePreset = { label: string; days: number }

export const RECENCY_DATE_PRESETS: DatePreset[] = [
  { label: "Last 24 hours", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 6 months", days: 182 },
  { label: "Last year", days: 365 },
]

export const MEDIA_TYPE_VALUES = [
  "ebook",
  "audiobook",
  "synced",
  "ebook-only",
  "audiobook-only",
  "missing-readaloud",
  "no-media",
] as const

export type MediaTypeValue = (typeof MEDIA_TYPE_VALUES)[number]

export const FIELD_REGISTRY = {
  // -- text -----------------------------------------------------------------
  title: {
    control: "text",
    sortable: true,
    defaultSort: "asc",
    quick: false,
    token: "title",
    labelKey: "title",
    group: "text",
    type: "string",
  },
  subtitle: {
    control: "text",
    sortable: false,
    quick: false,
    token: "subtitle",
    labelKey: "subtitle",
    group: "text",
    type: "string",
  },
  description: {
    control: "text",
    sortable: false,
    quick: false,
    token: "description",
    labelKey: "description",
    group: "text",
    type: "string",
  },
  language: {
    control: "facet",
    source: "distinct",
    sortable: true,
    defaultSort: "asc",
    quick: true,
    token: "language",
    labelKey: "language",
    group: "text",
    type: "string",
    defaultOperator: "isAnyOf",
  },
  review: {
    control: "text",
    sortable: false,
    quick: false,
    token: "review",
    labelKey: "review",
    group: "text",
    type: "string",
  },
  search: {
    control: "text",
    sortable: false,
    quick: false,
    token: "text",
    labelKey: "search",
    group: "text",
    type: "string",
  },

  pageCount: {
    control: "number-range",
    sortable: true,
    defaultSort: "desc",
    quick: true,
    discriminator: "format",
    formats: ["ebook", "readaloud"],
    scale: { min: 0, step: 1, unit: "count" },
    token: "pages",
    labelKey: "pageCount",
    options: [
      { min: 0, max: 150, label: "< 150" },
      { min: 150, max: 400, label: "150-400" },
      { min: 400, max: 800, label: "400-800" },
      { min: 800, max: Number.MAX_SAFE_INTEGER, label: "> 800" },
    ],
    group: "media",
    type: "number",
  },
  duration: {
    control: "duration-range",
    sortable: true,
    defaultSort: "desc",
    quick: true,
    discriminator: "format",
    formats: ["audiobook", "readaloud"],
    scale: { min: 0, unit: "seconds" },
    token: "duration",
    labelKey: "duration",
    options: [
      { min: 0, max: 3 * 3600, label: "< 3h" },
      { min: 3 * 3600, max: 10 * 3600, label: "3-10h" },
      { min: 10 * 3600, max: 20 * 3600, label: "10-20h" },
      { min: 20 * 3600, max: Number.MAX_SAFE_INTEGER, label: "> 20h" },
    ],
    group: "media",
    type: "number",
  },

  publicationDate: {
    control: "date-range",
    sortable: true,
    quick: true,
    defaultSort: "desc",
    scale: { unit: "year" },
    token: "published",
    labelKey: "publicationDate",
    group: "dates",
    type: "date",
  },
  createdAt: {
    control: "date-range",
    sortable: true,
    quick: true,
    defaultSort: "desc",
    token: "added",
    labelKey: "createdAt",
    presets: RECENCY_DATE_PRESETS,
    group: "dates",
    type: "date",
  },
  updatedAt: {
    control: "date-range",
    sortable: true,
    quick: true,
    defaultSort: "desc",
    token: "updated",
    labelKey: "updatedAt",
    presets: RECENCY_DATE_PRESETS,
    group: "dates",
    type: "date",
  },
  fileSize: {
    control: "number-range",
    sortable: true,
    quick: true,
    defaultSort: "desc",
    discriminator: "format",
    scale: { min: 0, step: 500, unit: "bytes" },
    token: "size",
    labelKey: "fileSize",
    options: [
      { min: 0, max: 5 * 1024 * 1024, label: "< 5 MB" },
      { min: 5 * 1024 * 1024, max: 20 * 1024 * 1024, label: "5-20 MB" },
      { min: 20 * 1024 * 1024, max: 100 * 1024 * 1024, label: "20-100 MB" },
      {
        min: 100 * 1024 * 1024,
        max: Number.MAX_SAFE_INTEGER,
        label: "> 100 MB",
      },
    ],
    group: "media",
    type: "number",
  },

  // -- facets / enum --------------------------------------------------------
  mediaType: {
    control: "enum",
    sortable: false,
    quick: true,
    options: [...MEDIA_TYPE_VALUES],
    token: "format",
    labelKey: "mediaType",
    group: "media",
    type: "enum",
  },
  tags: {
    control: "facet",
    sortable: false,
    quick: true,
    source: "tags",
    token: "tag",
    labelKey: "tags",
    group: "relations",
    type: "array",
  },
  collections: {
    control: "facet",
    sortable: false,
    quick: true,
    source: "collections",
    token: "collection",
    labelKey: "collections",
    group: "relations",
    type: "array",
  },
  series: {
    control: "facet",
    sortable: false,
    quick: true,
    source: "series",
    token: "series",
    labelKey: "series",
    group: "relations",
    type: "array",
  },
  authors: {
    control: "facet",
    sortable: true,
    defaultSort: "asc",
    quick: true,
    source: "authors",
    discriminator: "role",
    token: "author",
    labelKey: "authors",
    group: "creators",
    type: "array",
  },
  narrators: {
    control: "facet",
    sortable: false,
    quick: true,
    source: "narrators",
    discriminator: "role",
    token: "narrator",
    labelKey: "narrators",
    group: "creators",
    type: "array",
  },
  translators: {
    control: "facet",
    sortable: false,
    quick: true,
    source: "translators",
    discriminator: "role",
    token: "translator",
    labelKey: "translators",
    group: "creators",
    type: "array",
  },
  creators: {
    control: "facet",
    sortable: false,
    quick: true,
    source: "creators",
    discriminator: "role",
    token: "author",
    labelKey: "creators",
    group: "creators",
    type: "array",
  },

  // -- numeric --------------------------------------------------------------

  status: {
    control: "facet",
    sortable: false,
    quick: true,
    source: "statuses",
    token: "status",
    labelKey: "status",
    group: "relations",
    type: "uuid",
  },
  userRating: {
    control: "number-range",
    sortable: true,
    defaultSort: "desc",
    quick: true,
    scale: { min: 0, max: 5, step: 0.5, unit: "count" },
    token: "rating",
    labelKey: "userRating",
    options: [
      { min: 0, max: 0.99, label: "☆☆☆☆☆" },
      { min: 1, max: 1.99, label: "★☆☆☆☆" },
      { min: 2, max: 2.99, label: "★★☆☆☆" },
      { min: 3, max: 3.99, label: "★★★☆☆" },
      { min: 4, max: 4.99, label: "★★★★☆" },
      { min: 5, max: 5, label: "★★★★★" },
    ],
    group: "media",
    type: "number",
  },
  ratingDimension: {
    control: "number-range",
    sortable: false,
    quick: false,
    scale: { min: 0, max: 5, step: 1, unit: "count" },
    token: "axis",
    labelKey: "ratingDimension",
    group: "media",
    type: "number",
  },
  readingPosition: {
    control: "number-range",
    sortable: false,
    quick: true,
    scale: { min: 0, max: 1, step: 0.01, unit: "ratio" },
    token: "progress",
    labelKey: "readingPosition",
    options: [
      { min: 0, max: 0.001, label: "Not started" },
      { min: 0.001, max: 0.999, label: "In progress" },
      { min: 0.999, max: 1, label: "Finished" },
    ],
    group: "review",
    type: "number",
  },
  lastRead: {
    control: "date-range",
    sortable: true,
    defaultSort: "desc",
    quick: true,
    token: "read",
    labelKey: "lastRead",
    presets: RECENCY_DATE_PRESETS,
    group: "review",
    type: "date",
  },

  alignmentGrade: {
    control: "enum",
    sortable: true,
    quick: true,
    token: "grade",
    options: [...ALIGNMENT_GRADES],
    labelKey: "alignmentGrade",
    group: "alignment",
    type: "enum",
  },
  alignmentScore: {
    control: "number-range",
    sortable: true,
    quick: true,
    scale: { min: 0, max: 100, unit: "count" },
    token: "score",
    labelKey: "alignmentScore",
    group: "alignment",
    type: "number",
  },
  alignmentMissingSentences: {
    control: "number-range",
    sortable: true,
    quick: true,
    scale: { min: 0, unit: "count" },
    token: "missing",
    labelKey: "alignmentMissingSentences",
    group: "alignment",
    type: "number",
  },
  alignmentMutedChapters: {
    control: "number-range",
    sortable: true,
    quick: true,
    scale: { min: 0, unit: "count" },
    token: "muted",
    labelKey: "alignmentMutedChapters",
    group: "alignment",
    type: "number",
  },
  alignmentMissingChapters: {
    control: "number-range",
    sortable: true,
    quick: true,
    scale: { min: 0, unit: "count" },
    options: [
      { min: 1, max: Number.MAX_SAFE_INTEGER, label: "≥1" },
      { min: 0, max: 3, label: "≤2" },
      { min: 0, max: 6, label: "≤5" },
      { min: 0, max: 10, label: "≤10" },
      { min: 11, max: Number.MAX_SAFE_INTEGER, label: "> 10" },
    ],
    token: "missingChapters",
    labelKey: "alignmentMissingChapters",
    group: "alignment",
    type: "number",
  },
  alignedAt: {
    control: "date-range",
    sortable: true,
    quick: true,
    token: "aligned",
    labelKey: "alignedAt",
    presets: RECENCY_DATE_PRESETS,
    group: "alignment",
    type: "date",
  },
  // the transcription engine details ("whisper.cpp:tiny", "deepgram:nova-2")
  // the alignment ran with. the column predates the field and keeps its name.
  alignedWith: {
    control: "facet",
    source: "distinct",
    sortable: false,
    quick: true,
    token: "engine",
    labelKey: "alignedWith",
    group: "alignment",
    type: "string",
    defaultOperator: "isAnyOf",
  },
  alignedByStorytellerVersion: {
    control: "facet",
    source: "distinct",
    sortable: false,
    quick: true,
    token: "aligner",
    labelKey: "alignedByStorytellerVersion",
    group: "alignment",
    type: "string",
    defaultOperator: "isAnyOf",
  },
} as const satisfies Record<string, FieldDef>

export type Field = keyof typeof FIELD_REGISTRY

export const FIELDS = Object.keys(FIELD_REGISTRY) as Field[]

export function getFieldDef(field: Field): FieldDef {
  return FIELD_REGISTRY[field]
}

export function getFieldType(field: Field) {
  return FIELD_REGISTRY[field].type
}

export type StringField = AcceptedKeys<
  typeof FIELD_REGISTRY,
  { type: "string" }
>
export const STRING_FIELDS = Object.keys(FIELD_REGISTRY).filter(
  (f) => FIELD_REGISTRY[f as Field].type === "string",
) as StringField[]

export type NumberField = AcceptedKeys<
  typeof FIELD_REGISTRY,
  { type: "number" }
>
export const NUMBER_FIELDS = Object.keys(FIELD_REGISTRY).filter(
  (f) => FIELD_REGISTRY[f as Field].type === "number",
) as NumberField[]

export type DateField = AcceptedKeys<typeof FIELD_REGISTRY, { type: "date" }>
export const DATE_FIELDS = Object.keys(FIELD_REGISTRY).filter(
  (f) => FIELD_REGISTRY[f as Field].type === "date",
) as DateField[]

export type UUIDField = AcceptedKeys<typeof FIELD_REGISTRY, { type: "uuid" }>
export const UUID_FIELDS = Object.keys(FIELD_REGISTRY).filter(
  (f) => FIELD_REGISTRY[f as Field].type === "uuid",
) as UUIDField[]

export type ArrayField = AcceptedKeys<typeof FIELD_REGISTRY, { type: "array" }>
export const ARRAY_FIELDS = Object.keys(FIELD_REGISTRY).filter(
  (f) => FIELD_REGISTRY[f as Field].type === "array",
) as ArrayField[]

export type EnumField = AcceptedKeys<typeof FIELD_REGISTRY, { type: "enum" }>
export const ENUM_FIELDS = Object.keys(FIELD_REGISTRY).filter(
  (f) => FIELD_REGISTRY[f as Field].type === "enum",
) as EnumField[]

export type CanBeEmptyField = AcceptedKeys<
  typeof FIELD_REGISTRY,
  { type: "string" | "number" | "date" | "uuid" | "enum" }
>
// TODO: exclude search
export const CAN_BE_EMPTY_FIELDS = Object.keys(FIELD_REGISTRY).filter((f) => {
  const field = FIELD_REGISTRY[f as Field]
  if (field.labelKey === "search") {
    return false
  }

  return true
}) as CanBeEmptyField[]

export type QuickFilterField = AcceptedKeys<
  typeof FIELD_REGISTRY,
  { quick: true }
>
export const QUICK_FILTER_FIELDS = Object.keys(FIELD_REGISTRY).filter((f) => {
  const field = FIELD_REGISTRY[f as Field]
  return field.quick
}) as QuickFilterField[]

// fields whose facet options are the distinct stored values of their own book
// column. doubles as the server-side allowlist for the distinct endpoint.
export type DistinctFacetField = AcceptedKeys<
  typeof FIELD_REGISTRY,
  { control: "facet"; source: "distinct" }
>
export const DISTINCT_FACET_FIELDS = FIELDS.filter((f) => {
  const def = FIELD_REGISTRY[f]
  return def.control === "facet" && def.source === "distinct"
}) as DistinctFacetField[]

export function isDistinctFacetField(
  value: string,
): value is DistinctFacetField {
  return (DISTINCT_FACET_FIELDS as string[]).includes(value)
}
