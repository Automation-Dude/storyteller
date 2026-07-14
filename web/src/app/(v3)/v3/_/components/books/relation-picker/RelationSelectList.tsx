"use client"

import { type ReactNode, useEffect, useMemo, useRef } from "react"

import { VirtualizedFilterableMenuItems } from "@v3/_/components/ui/filterable-menu"

import { RelationGlyph } from "@/app/(v3)/v3/_/components/books/RelationChipEditor"
import { ICheck, IRemove } from "@/app/(v3)/v3/_/components/ui/icon"
import {
  type RelationItem,
  type RelationSource,
  useRelationItems,
} from "@/app/(v3)/v3/_/hooks/use-relation-items"

// a row's selection state, rendered as a trailing icon. what "primary" and
// "secondary" mean is up to the caller (include/exclude, all/some, selected).
export type RelationRowState = "primary" | "secondary" | "none"

function defaultTrailing(state: RelationRowState): ReactNode {
  if (state === "primary")
    return <ICheck.base className="text-primary h-4 w-4" />
  if (state === "secondary")
    return <IRemove.base className="text-muted-foreground h-4 w-4" />
  return null
}

// the one relation list: fetches (lazily) + alphabetises via useRelationItems,
// floats applied rows to the top (frozen while the menu is open so they don't
// jump), and renders through the virtualized menu primitive. drop it inside a
// FilterableMenuContent / FilterableMenuSubContent (which supplies the search).
export function RelationSelectList({
  source,
  items: itemsProp,
  loading: loadingProp,
  enabled,
  stateOf,
  onSelect,
  renderTrailing = defaultTrailing,
  filter,
  create,
  footer,
  emptyText,
}: {
  source?: RelationSource
  items?: RelationItem[]
  loading?: boolean
  enabled: boolean
  stateOf: (item: RelationItem) => RelationRowState
  onSelect: (item: RelationItem) => void
  renderTrailing?: (state: RelationRowState) => ReactNode
  filter?: (item: RelationItem) => boolean
  create?: {
    label: (query: string) => string
    onCreate: (query: string) => void
  }
  footer?: ReactNode
  emptyText?: string
}) {
  const fetched = useRelationItems(source, enabled && !itemsProp)
  const rawItems = itemsProp ?? fetched.items
  const loading = loadingProp ?? (itemsProp ? false : fetched.loading)

  const items = useMemo(
    () => (filter ? rawItems.filter(filter) : rawItems),
    [rawItems, filter],
  )

  // capture which rows are applied when the menu opens, and keep that order for
  // the whole session so toggling a row doesn't reshuffle the list under the
  // cursor. recaptured on the next open.
  const snapshotRef = useRef<Set<string> | null>(null)
  if (enabled && items.length > 0 && snapshotRef.current === null) {
    snapshotRef.current = new Set(
      items.filter((i) => stateOf(i) !== "none").map((i) => i.uuid),
    )
  }
  useEffect(() => {
    if (!enabled) snapshotRef.current = null
  }, [enabled])

  const ordered = useMemo(() => {
    const snap = snapshotRef.current
    if (!snap || snap.size === 0) return items
    return [...items].sort(
      (a, b) => (snap.has(a.uuid) ? 0 : 1) - (snap.has(b.uuid) ? 0 : 1),
    )
  }, [items])

  return (
    <VirtualizedFilterableMenuItems
      items={ordered}
      getKey={(i) => i.uuid}
      getText={(i) => i.name}
      onSelect={(item) => {
        onSelect(item)
      }}
      loading={loading}
      emptyText={emptyText}
      create={create}
      footer={footer}
      renderRow={(item) => (
        <>
          <RelationGlyph item={item} />
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          <span className="flex w-4 shrink-0 items-center justify-center">
            {renderTrailing(stateOf(item))}
          </span>
        </>
      )}
    />
  )
}
