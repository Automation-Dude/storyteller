"use client"

import { type ReactElement, type ReactNode, useMemo, useState } from "react"

import {
  FilterableMenu,
  FilterableMenuContent,
  FilterableMenuTrigger,
} from "@v3/_/components/ui/filterable-menu"

import {
  type RelationItem,
  type RelationSource,
} from "@/app/(v3)/v3/_/hooks/use-relation-items"
import { type BookWithRelations } from "@/database/books"
import { type UUID } from "@/uuid"

import {
  type MembershipState,
  RelationEditList,
  type RelationMembership,
  membershipFromBooks,
} from "./RelationEditList"

// filterable-menu shell around RelationEditList: owns open state and drives the
// picker's lazy fetch (the content only mounts, so only fetches, once opened).
// membership is supplied either as a book list (action menu) or as explicit uuids
// + counts (the inline chip editors, which only hold the current relation, not
// the book). the picker brings its own search, so the menu content hides its.
export function RelationEditMenu({
  source,
  books,
  bookUuids: bookUuidsProp,
  membership: membershipProp,
  searchPlaceholder,
  showApplied,
  onCreate,
  createLabel,
  onSelectOverride,
  ...triggerProps
}: {
  source: RelationSource
  books?: BookWithRelations[]
  bookUuids?: UUID[]
  membership?: RelationMembership
  searchPlaceholder: string
  showApplied?: boolean
  onCreate?: (name: string) => void
  createLabel?: (search: string) => string
  onSelectOverride?: (item: RelationItem, state: MembershipState) => void
} & (
  | { icon: ReactNode; label: string; trigger?: never }
  | { trigger: ReactElement; icon?: never; label?: never }
)) {
  const [open, setOpen] = useState(false)

  const bookUuids = useMemo(
    () => bookUuidsProp ?? books?.map((b) => b.uuid) ?? [],
    [bookUuidsProp, books],
  )
  const membership = useMemo(
    () =>
      membershipProp ??
      (books ? membershipFromBooks(books, source) : new Map()),
    [membershipProp, books, source],
  )

  return (
    <FilterableMenu open={open} onOpenChange={setOpen}>
      {triggerProps.trigger ? (
        <FilterableMenuTrigger render={triggerProps.trigger} />
      ) : (
        <FilterableMenuTrigger>
          {triggerProps.icon}
          {triggerProps.label}
        </FilterableMenuTrigger>
      )}
      <FilterableMenuContent searchPlaceholder={searchPlaceholder} align="start">
        <RelationEditList
          source={source}
          bookUuids={bookUuids}
          membership={membership}
          enabled={open}
          showApplied={showApplied}
          onCreate={onCreate}
          createLabel={createLabel}
          onSelectOverride={onSelectOverride}
        />
      </FilterableMenuContent>
    </FilterableMenu>
  )
}
