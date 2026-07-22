import { FIELDS, FIELD_REGISTRY, type Field } from "./registry"

// the alias declarations live on the registry entries; this module derives
// the lookup tables every layer shares.

export type AliasField = {
  [F in Field]: (typeof FIELD_REGISTRY)[F] extends { alias: unknown }
    ? F
    : never
}[Field]

/** fields that are real conditions after normalization (aliases expanded). */
export type BaseField = Exclude<Field, AliasField>

export const ALIAS_FIELDS = FIELDS.filter(
  (f) => "alias" in FIELD_REGISTRY[f],
) as AliasField[]

export const BASE_FIELDS = FIELDS.filter(
  (f) => !("alias" in FIELD_REGISTRY[f]),
) as BaseField[]

export function isAliasField(field: Field): field is AliasField {
  return "alias" in FIELD_REGISTRY[field]
}

/**
 * resolves a field to its base field + bound qualifier. non-alias fields
 * resolve to themselves with no qualifier.
 */
export function resolveFieldAlias(field: Field): {
  field: BaseField
  qualifier?: string
} {
  const def = FIELD_REGISTRY[field]
  if ("alias" in def) {
    return { field: def.alias.of as BaseField, qualifier: def.alias.qualifier }
  }
  return { field: field as BaseField }
}

/**
 * the alias presenting a (base field, qualifier) pair, if one exists
 * (creators + "aut" → authors). used to keep UI labels on the alias.
 */
export function aliasForQualifier(
  field: Field,
  qualifier: string | undefined,
): AliasField | null {
  if (!qualifier) return null
  for (const alias of ALIAS_FIELDS) {
    const def = FIELD_REGISTRY[alias]
    if (
      "alias" in def &&
      def.alias.of === field &&
      def.alias.qualifier === qualifier
    ) {
      return alias
    }
  }
  return null
}
