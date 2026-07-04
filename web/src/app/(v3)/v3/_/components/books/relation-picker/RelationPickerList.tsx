"use client"

import { useVirtualizer } from "@tanstack/react-virtual"
import {
  type CSSProperties,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react"

import { Input } from "@v3/_/components/ui/input"
import { Skeleton } from "@v3/_/components/ui/skeleton"
import { useCommon } from "@v3/_/hooks/use-translation"

import { IAdd } from "../../ui/icon"
import {
  type RelationItem,
  type RelationSource,
  useRelationItems,
} from "../../../hooks/use-relation-items"

const ROW_HEIGHT = 32

// context handed to renderRow so callers can position virtualized rows and key
// them consistently, without re-implementing the virtualizer.
export type RelationRowContext = {
  index: number
  filtered: RelationItem[]
  // set only when virtualized; spread onto the row's root element
  style?: CSSProperties
  key: string
}

// the shared list body used by every relation picker: lazy fetch (only when
// `enabled`), search box, optional virtualization, and an optional create-inline
// row. Row visuals + click semantics are the caller's job via `renderRow`.
export function RelationPickerList({
  source,
  items: itemsProp,
  loading: loadingProp,
  enabled,
  virtualized = true,
  searchPlaceholder,
  autoFocusSearch = true,
  renderRow,
  filter,
  sort,
  create,
  footer,
}: {
  // fetch lazily by source, OR pass an explicit list (e.g. role-scoped creators)
  source?: RelationSource
  items?: RelationItem[]
  loading?: boolean
  enabled: boolean
  virtualized?: boolean
  searchPlaceholder: string
  autoFocusSearch?: boolean
  renderRow: (item: RelationItem, ctx: RelationRowContext) => ReactNode
  // optional predicate applied after the search filter (e.g. hide applied items)
  filter?: (item: RelationItem) => boolean
  // optional ordering applied after filtering (e.g. applied-on-top)
  sort?: (a: RelationItem, b: RelationItem) => number
  // when set, a "create '<search>'" row is offered while the search text has no
  // exact match
  create?: {
    label: (search: string) => string
    onCreate: (name: string) => void
  }
  footer?: ReactNode
}) {
  const c = useCommon()
  const [search, setSearch] = useState("")
  const fetched = useRelationItems(source, enabled && !itemsProp)
  const items = itemsProp ?? fetched.items
  const loading = loadingProp ?? fetched.loading

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = q
      ? items.filter((i) => i.name.toLowerCase().includes(q))
      : items.slice()
    if (filter) list = list.filter(filter)
    return sort ? list.sort(sort) : list
  }, [items, search, filter, sort])

  const trimmed = search.trim()
  const showCreate =
    !!create &&
    trimmed.length > 0 &&
    !items.some((i) => i.name.toLowerCase() === trimmed.toLowerCase())

  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => {
      // the menu unmounts its content when closed; bail so the virtualizer
      // doesn't measure a detached node
      if (!scrollRef.current?.isConnected) return null
      return scrollRef.current
    },
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })
  console.log("search", search)

  return (
    <div className="flex flex-col">
      <div className="p-1">
        <Input
          autoFocus={autoFocusSearch}
          value={search}
          defaultValue={search}
          placeholder={searchPlaceholder}
          onChange={(e) => {
            setSearch(e.target.value)
          }}
          className="h-8"
        />
      </div>

      <div ref={scrollRef} className="scroll-y max-h-64 px-1">
        {loading ? (
          <div className="space-y-1 p-1">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={`loading-${idx}`}
                className="flex items-center gap-2 px-2 py-1.5"
              >
                <Skeleton className="h-3 w-3" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 && !showCreate ? (
          <div className="text-muted-foreground px-2 py-3 text-center text-xs">
            {c("empty.noResults")}
          </div>
        ) : virtualized ? (
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
            key={filtered.length}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const item = filtered[row.index]
              if (!item) return null
              return renderRow(item, {
                index: row.index,
                filtered,
                key: item.uuid,
                style: {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: ROW_HEIGHT,
                  transform: `translateY(${row.start}px)`,
                },
              })
            })}
          </div>
        ) : (
          filtered.map((item, index) =>
            renderRow(item, { index, filtered, key: item.uuid }),
          )
        )}
      </div>

      {showCreate && create && (
        <button
          type="button"
          onClick={() => {
            create.onCreate(trimmed)
          }}
          className="hover:bg-accent text-primary mx-1 mb-1 flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs"
        >
          <IAdd.base className="h-3.5 w-3.5" />
          {create.label(trimmed)}
        </button>
      )}

      {footer}
    </div>
  )
}
