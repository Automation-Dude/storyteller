"use client"

import { type ReactNode, useMemo } from "react"

import { FilterableList } from "@v3/_/components/ui/filterable-menu"

import {
  type RelationItem,
  type RelationSource,
  useRelationItems,
} from "../../../hooks/use-relation-items"

export function RelationPickerList({
  source,
  items: itemsProp,
  loading: loadingProp,
  enabled,
  virtualized,
  searchPlaceholder,
  autoFocusSearch = true,
  onSelect,
  renderRow,
  filter,
  sort,
  create,
  footer,
  emptyText,
}: {
  source?: RelationSource
  items?: RelationItem[]
  loading?: boolean
  enabled: boolean
  virtualized?: boolean
  searchPlaceholder: string
  autoFocusSearch?: boolean
  onSelect?: (item: RelationItem, event: React.MouseEvent) => void
  renderRow: (item: RelationItem) => ReactNode
  filter?: (item: RelationItem) => boolean
  sort?: (a: RelationItem, b: RelationItem) => number
  create?: {
    label: (search: string) => string
    onCreate: (name: string) => void
  }
  footer?: ReactNode
  emptyText?: string
}) {
  const fetched = useRelationItems(source, enabled && !itemsProp)
  const items = itemsProp ?? fetched.items
  const loading = loadingProp ?? fetched.loading

  const prepared = useMemo(() => {
    let list = filter ? items.filter(filter) : items.slice()
    if (sort) list = list.sort(sort)
    return list
  }, [items, filter, sort])

  return (
    <FilterableList<RelationItem>
      items={prepared}
      loading={loading}
      virtualized={virtualized}
      searchPlaceholder={searchPlaceholder}
      autoFocusSearch={autoFocusSearch}
      onSelect={onSelect}
      renderRow={renderRow}
      create={create}
      footer={footer}
      emptyText={emptyText}
    />
  )
}
