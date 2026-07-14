import { useMemo } from "react"

import {
  useListAuthorsQuery,
  useListCollectionsQuery,
  useListCreatorsQuery,
  useListNarratorsQuery,
  useListSeriesQuery,
  useListStatusesQuery,
  useListTagsQuery,
  useListTranslatorsQuery,
} from "@/store/api"

// a "relation" is one of the many-to-many, per-table things a book can have
// several of and add/remove freely.
export type RelationSource =
  | "tags"
  | "collections"
  | "series"
  | "authors"
  | "creators"
  | "narrators"
  | "translators"
  | "statuses"

export type RelationItem = {
  uuid: string
  name: string
  icon?: string | null
  color?: string | null
}

// fetch the list of all items for a relation source, lazily: the underlying
// query stays skipped until `enabled` (e.g. the menu opens).
export function useRelationItems(
  source: RelationSource | undefined,
  enabled: boolean,
): { items: RelationItem[]; loading: boolean } {
  const tags = useListTagsQuery(undefined, {
    skip: !enabled || source !== "tags",
  })
  const collections = useListCollectionsQuery(undefined, {
    skip: !enabled || source !== "collections",
  })
  const series = useListSeriesQuery(undefined, {
    skip: !enabled || source !== "series",
  })
  const allCreators = useListCreatorsQuery(undefined, {
    skip:
      !enabled ||
      (source !== "creators" &&
        source !== "authors" &&
        source !== "narrators" &&
        source !== "translators"),
  })
  const authors = {
    data: allCreators.data?.filter((c) => c.roles.includes("aut")),
    isLoading: allCreators.isLoading,
  }
  console.log("aa", allCreators.data)
  const narrators = {
    data: allCreators.data?.filter((c) => c.roles.includes("nrt")),
    isLoading: allCreators.isLoading,
  }

  const translators = {
    data: allCreators.data?.filter((c) => c.roles.includes("trl")),
    isLoading: allCreators.isLoading,
  }
  const creators = {
    data: allCreators.data?.filter(
      (c) =>
        !c.roles.includes("aut") &&
        !c.roles.includes("nrt") &&
        !c.roles.includes("trl"),
    ),
    isLoading: allCreators.isLoading,
  }

  const statuses = useListStatusesQuery(undefined, {
    skip: !enabled || source !== "statuses",
  })

  const active =
    source === "tags"
      ? tags
      : source === "collections"
        ? collections
        : source === "series"
          ? series
          : source === "creators"
            ? creators
            : source === "authors"
              ? authors
              : source === "narrators"
                ? narrators
                : source === "translators"
                  ? translators
                  : source === "statuses"
                    ? statuses
                    : undefined

  const items = useMemo<RelationItem[]>(
    () =>
      (active?.data ?? []).map((d: RelationItem) => ({
        uuid: d.uuid,
        name: d.name,
        icon: d.icon,
        color: d.color,
      })),
    [active?.data],
  )

  return { items, loading: !!active?.isLoading }
}
