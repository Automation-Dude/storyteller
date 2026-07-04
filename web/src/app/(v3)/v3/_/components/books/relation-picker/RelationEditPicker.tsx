"use client"

import { type ReactNode, useMemo } from "react"

import { DropdownMenuItem } from "@v3/_/components/ui/dropdown-menu"
import { cn } from "@v3/_/lib/utils"

import { ICheck, IRemove } from "../../ui/icon"
import { RelationGlyph } from "../RelationChipEditor"
import { RelationPickerList } from "./RelationPickerList"
import { type BookWithRelations } from "@/database/books"
import { type UUID } from "@/uuid"

import {
  type RelationItem,
  type RelationSource,
} from "../../../hooks/use-relation-items"
import { useRelationEditActions } from "../../../hooks/use-relation-mutations"

export type MembershipState = "all" | "some" | "none"

// how many of a set of books currently have each relation, keyed by item uuid.
export type RelationMembership = Map<string, number>

// the relation uuids a single book currently has for the given source
function bookRelationUuids(
  book: BookWithRelations,
  source: RelationSource,
): string[] {
  switch (source) {
    case "tags":
      return book.tags.map((t) => t.uuid)
    case "collections":
      return book.collections.map((c) => c.uuid)
    case "series":
      return book.series.map((s) => s.uuid)
    case "statuses":
      return book.status ? [book.status.uuid] : []
    case "creators":
      return book.creators.map((c) => c.uuid)
  }
}

// build the uuid -> count membership map from a set of books
export function membershipFromBooks(
  books: BookWithRelations[],
  source: RelationSource,
): RelationMembership {
  const m: RelationMembership = new Map()
  for (const book of books) {
    for (const uuid of bookRelationUuids(book, source)) {
      m.set(uuid, (m.get(uuid) ?? 0) + 1)
    }
  }
  return m
}

export function RelationEditPicker({
  source,
  bookUuids,
  membership,
  enabled,
  searchPlaceholder,
  showApplied = true,
  onCreate,
  createLabel,
  onSelectOverride,
}: {
  source: RelationSource
  bookUuids: UUID[]
  membership: RelationMembership
  enabled: boolean
  searchPlaceholder: string
  // when false, already-applied items are hidden (add-only feel); removal then
  // happens elsewhere, e.g. the inline chips
  showApplied?: boolean
  // when set, offers a "create '<search>'" row
  onCreate?: (name: string) => void
  createLabel?: (search: string) => string
  // fully overrides the default add on click (e.g. series opens a position
  // dialog instead of attaching directly)
  onSelectOverride?: (item: RelationItem, state: MembershipState) => void
}) {
  const actions = useRelationEditActions(source)

  const stateOf = useMemo(() => {
    const total = bookUuids.length
    return (uuid: string): MembershipState => {
      const n = membership.get(uuid) ?? 0
      if (n === 0) return "none"
      if (total > 0 && n === total) return "all"
      return "some"
    }
  }, [membership, bookUuids.length])

  const handleClick = (item: RelationItem, state: MembershipState) => {
    if (onSelectOverride) {
      onSelectOverride(item, state)
      return
    }
    if (actions.singleSelect) {
      actions.add(bookUuids, item)
      return
    }
    if (state === "all") {
      actions.remove(bookUuids, item.uuid as UUID)
    } else {
      actions.add(bookUuids, item)
    }
  }

  const trailing = (state: MembershipState): ReactNode => {
    if (state === "all") return <ICheck.base className="text-primary h-4 w-4" />
    if (state === "some")
      return <IRemove.base className="text-muted-foreground h-4 w-4" />
    return null
  }

  return (
    <RelationPickerList
      source={source}
      enabled={enabled}
      searchPlaceholder={searchPlaceholder}
      filter={showApplied ? undefined : (i) => stateOf(i.uuid) === "none"}
      // applied (all/some) float to the top, preserving name order within a group
      sort={(a, b) => rank(stateOf(a.uuid)) - rank(stateOf(b.uuid))}
      create={
        onCreate
          ? {
              label: (s) => createLabel?.(s) ?? `Create "${s}"`,
              onCreate,
            }
          : undefined
      }
      renderRow={(item, ctx) => {
        const state = stateOf(item.uuid)
        return (
          // you may be tempted to use a DropdownMenuItem here
          // do not! it will eat keydowns to quickly select items, which doesn't
          // work w the search box
          <button
            key={ctx.key}
            closeOnClick={false}
            onClick={(e) => {
              handleClick(item, state)
              e.preventDefault()
            }}
            className={cn(
              "flex w-full! items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs",
            )}
            style={ctx.style}
          >
            <RelationGlyph item={item} />
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            <span className="flex w-4 shrink-0 items-center justify-center">
              {trailing(state)}
            </span>
          </button>
        )
      }}
    />
  )
}

// applied items rank before unapplied ones
function rank(state: MembershipState): number {
  return state === "none" ? 1 : 0
}
