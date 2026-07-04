import { useMemo } from "react"

import {
  useListCollectionsQuery,
  useListCreatorsQuery,
  useListSeriesQuery,
  useListStatusesQuery,
  useListTagsQuery,
} from "@/store/api"

// a "relation" is one of the many-to-many, per-table things a book can have
// several of and add/remove freely.
export type RelationSource =
  | "tags"
  | "collections"
  | "series"
  | "creators"
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
  const creators = useListCreatorsQuery(undefined, {
    skip: !enabled || source !== "creators",
  })
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
