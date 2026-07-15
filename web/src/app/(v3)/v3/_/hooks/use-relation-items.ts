import { useLocale } from "next-intl"
import { useMemo } from "react"

import { type FacetSource, type Field } from "@/fields"
import {
  useListAuthorsQuery,
  useListCollectionsQuery,
  useListCreatorsQuery,
  useListDistinctFieldValuesQuery,
  useListNarratorsQuery,
  useListSeriesQuery,
  useListStatusesQuery,
  useListTagsQuery,
  useListTranslatorsQuery,
} from "@/store/api"

// a "relation" is one of the many-to-many, per-table things a book can have
// several of and add/remove freely. the vocabulary is exactly the registry's
// facet sources, so a picker can never drift from the field it backs.
export type RelationSource = FacetSource

export type RelationItem = {
  uuid: string
  name: string
  icon?: string | null
  color?: string | null
  // MARC relator codes the person holds (only present for the creators source)
  roles?: readonly string[]
}

// a permissive shape every list query's rows satisfy; icon/color/roles are only
// present on some sources.
type RelationRow = {
  uuid: string
  name: string
  icon?: string | null
  color?: string | null
  roles?: readonly string[]
}

// display name for a raw distinct value; only language codes get special
// treatment (localized language names), everything else shows verbatim.
function distinctValueName(
  field: Field | undefined,
  value: string,
  locale: string,
): string {
  if (field !== "language") return value
  try {
    return (
      new Intl.DisplayNames([locale], {
        type: "language",
        languageDisplay: "dialect",
      }).of(value) ?? value
    )
  } catch {
    return value
  }
}

export function useRelationItems(
  source: RelationSource | undefined,
  enabled: boolean,
  // the registry field backing a "distinct" source (its own column supplies
  // the option values); unused for the entity-table sources.
  field?: Field,
): { items: RelationItem[]; loading: boolean } {
  const locale = useLocale()

  // each source has its own endpoint; only the active one is fetched, and only
  // once the picker is enabled (opened).
  const on = (s: RelationSource) => enabled && source === s

  const tags = useListTagsQuery(undefined, { skip: !on("tags") })
  const collections = useListCollectionsQuery(undefined, {
    skip: !on("collections"),
  })
  const series = useListSeriesQuery(undefined, { skip: !on("series") })
  const statuses = useListStatusesQuery(undefined, { skip: !on("statuses") })
  const authors = useListAuthorsQuery(undefined, { skip: !on("authors") })
  const narrators = useListNarratorsQuery(undefined, { skip: !on("narrators") })
  const translators = useListTranslatorsQuery(undefined, {
    skip: !on("translators"),
  })
  // "creators" is everyone without a first-class role facet, so it filters the
  // full list client-side (there is no dedicated endpoint for it).
  const creators = useListCreatorsQuery(undefined, { skip: !on("creators") })
  const distinct = useListDistinctFieldValuesQuery(
    { field: field ?? "" },
    { skip: !on("distinct") || !field },
  )

  const active = (() => {
    switch (source) {
      case "tags":
        return tags
      case "collections":
        return collections
      case "series":
        return series
      case "statuses":
        return statuses
      case "authors":
        return authors
      case "narrators":
        return narrators
      case "translators":
        return translators
      case "creators":
        return creators
      case "distinct":
        return distinct
      default:
        return undefined
    }
  })()

  const data = active?.data
  const items = useMemo<RelationItem[]>(() => {
    if (source === "distinct") {
      const values = (data ?? []) as readonly string[]
      return values
        .map((value) => ({
          uuid: value,
          name: distinctValueName(field, value, locale),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    }

    const rows = (data ?? []) as readonly RelationRow[]
    const list =
      source === "creators"
        ? rows.filter(
            (c) =>
              !c.roles?.includes("aut") &&
              !c.roles?.includes("nrt") &&
              !c.roles?.includes("trl"),
          )
        : rows
    return list
      .map((d) => ({
        uuid: d.uuid,
        name: d.name,
        icon: d.icon,
        color: d.color,
        ...(source === "creators" && d.roles ? { roles: d.roles } : {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data, source, field, locale])

  return { items, loading: !!active?.isLoading }
}
