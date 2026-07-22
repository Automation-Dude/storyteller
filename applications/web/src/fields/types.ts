import { type ShelfFilterOperator } from "@/shelves"

/** the section of the advanced-editor field picker a field is listed under. */
export type FieldGroupKey =
  | "text"
  | "dates"
  | "review"
  | "relations"
  | "media"
  | "alignment"
  | "creators"

/**
 * which value editor the filter UI renders for a field. "facet" is a picker
 * over a closed-ish set of values (relations, distinct column values); "enum"
 * is a picker over a hardcoded option list; the rest are scalar inputs.
 */
export type FieldControl =
  | "text"
  | "number-range"
  | "date-range"
  | "duration-range"
  | "facet"
  | "enum"

/**
 * where a facet control's pickable values come from. entity sources map to a
 * list endpoint; "distinct" reads the distinct values of a book column
 * (language, transcription engine); "identifiers" lists identifier types.
 */
export type FacetSource =
  | "tags"
  | "collections"
  | "series"
  | "statuses"
  | "authors"
  | "narrators"
  | "translators"
  | "creators"
  | "identifiers"
  | "distinct"

/** display + input bounds for numeric fields. */
export type FieldScale = {
  min?: number
  max?: number
  step?: number
  unit?: "bytes" | "seconds" | "count" | "ratio" | "year"
}

/**
 * the shape of a condition's value for this field, which picks the operator
 * set and the zod condition variant. "array" fields hold entity uuids;
 * "uuid" is a single-entity field (status); "enum" a closed value list.
 */
export type FieldType = "string" | "number" | "date" | "uuid" | "array" | "enum"

/**
 * the vocabulary a field's `qualifier` is drawn from. a qualifier narrows a
 * condition to one sub-key of the field: a marc relator role for creators, a
 * rating axis id for userRating, an identifier type uuid for identifiers.
 */
export type QualifierKind =
  | "role"
  | "ratingAxis"
  | "identifierScheme"
  | "datePart"

/**
 * entity types a shelf filter can reference. mirrored into the
 * shelf_filter_reference table so deleting an entity cleans stored filters.
 */
export type FilterEntityType =
  | "tag"
  | "collection"
  | "series"
  | "status"
  | "creator"
  | "identifierType"

export const ASSET_FORMATS = ["ebook", "audiobook", "readaloud"] as const
export type AssetFormat = (typeof ASSET_FORMATS)[number]

export type DatePreset = { label: string; days: number }

export type FieldDefBase = {
  /** whether the field can order the book grid (client + SQL sort exist). */
  sortable: boolean
  /** the direction a fresh sort on this field starts with. */
  defaultSort?: "asc" | "desc"
  /** whether the field appears in the quick-filter chip row. */
  quick: boolean
  /** the short token used in search-syntax filters (e.g. "tag:fiction"). */
  token: string
  /** the Common.fields.label translation key for the field's display name. */
  labelKey: string
  /** the advanced-editor picker group the field is listed under. */
  group: FieldGroupKey
  /** the condition value shape; see FieldType. */
  type: FieldType
  /**
   * declares that conditions on this field accept a `qualifier`. absent =
   * conditions never carry one. an unqualified condition on a qualifiable
   * field addresses the whole field (userRating without an axis = the
   * overall rating).
   */
  qualifier?: { kind: QualifierKind }
  /**
   * the asset formats this field's value can be scoped to via a condition's
   * `format`. absent = the field is book-level only. an unscoped condition
   * coalesces across formats.
   */
  formats?: readonly AssetFormat[]
  /**
   * whether conditions may aggregate the field with `aggregate: "count"`
   * (how MANY tags/creators/identifiers, not which ones).
   */
  countable?: true
  /** the entity type of the uuids in this field's condition values. drives
   * shelf_filter_reference extraction and deleted-entity cleanup. */
  entity?: FilterEntityType
  /** the entity type of this field's qualifier values (identifier types). */
  qualifierEntity?: FilterEntityType
  /**
   * marks a UI-level shorthand for another field with a fixed qualifier
   * (authors = creators@aut). alias conditions are expanded to the base
   * field before validation, SQL, and entity extraction; only presentation
   * (labels, icons, pickers) treats them as fields of their own.
   */
  alias?: { of: string; qualifier: string }
  /** extra operators offered beyond the FieldType's default set. */
  extraOperators?: ShelfFilterOperator[]
  /** the operator a freshly added condition on this field starts with. */
  defaultOperator?: ShelfFilterOperator
}

export type FieldDefText = FieldDefBase & {
  control: "text"
}

export type FieldDefFacet = FieldDefBase & {
  control: "facet"
  source: FacetSource
}

export type FieldDefEnum = FieldDefBase & {
  control: "enum"
  options: string[]
}

export type FieldDefNumeric = FieldDefBase & {
  control: "number-range"
  scale?: FieldScale
  options?: { min: number; max: number; label: string }[]
}

export type FieldDefDate = FieldDefBase & {
  control: "date-range"
  qualifier: { kind: "datePart" }
  scale?: FieldScale
  presets?: DatePreset[]
}

export type FieldDefDuration = FieldDefBase & {
  control: "duration-range"
  scale: FieldScale
  options?: { min: number; max: number; label: string }[]
}

export type FieldDef =
  | FieldDefFacet
  | FieldDefEnum
  | FieldDefNumeric
  | FieldDefDate
  | FieldDefDuration
  | FieldDefText
