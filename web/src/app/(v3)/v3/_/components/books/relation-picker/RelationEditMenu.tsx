"use client"

import { type ReactElement, type ReactNode, useMemo, useState } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropDownMenuDontEatMyKeydowns,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"

import {
  type MembershipState,
  type RelationMembership,
  RelationEditPicker,
  membershipFromBooks,
} from "./RelationEditPicker"
import { type BookWithRelations } from "@/database/books"
import { type UUID } from "@/uuid"

import {
  type RelationItem,
  type RelationSource,
} from "../../../hooks/use-relation-items"

// dropdown (or submenu) shell around RelationEditPicker: owns open state and
// drives the picker's lazy fetch (only fetches once opened). Membership is
// supplied either as a book list (action menu) or as explicit uuids + counts
// (the inline chip editors, which only hold the current relation, not the book).
export function RelationEditMenu({
  source,
  books,
  bookUuids: bookUuidsProp,
  membership: membershipProp,
  searchPlaceholder,
  subMenu = false,
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
  subMenu?: boolean
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

  const picker = (
    <RelationEditPicker
      source={source}
      bookUuids={bookUuids}
      membership={membership}
      enabled={open}
      searchPlaceholder={searchPlaceholder}
      showApplied={showApplied}
      onCreate={onCreate}
      createLabel={createLabel}
      onSelectOverride={onSelectOverride}
    />
  )

  if (subMenu) {
    return (
      <DropdownMenuSub open={open} onOpenChange={setOpen}>
        {triggerProps.trigger ? (
          <DropdownMenuSubTrigger render={triggerProps.trigger} />
        ) : (
          <DropdownMenuSubTrigger>
            {triggerProps.icon}
            {triggerProps.label}
          </DropdownMenuSubTrigger>
        )}
        <DropdownMenuSubContent className="w-64 p-1">
          <DropDownMenuDontEatMyKeydowns>
            {picker}
          </DropDownMenuDontEatMyKeydowns>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {triggerProps.trigger ? (
        <DropdownMenuTrigger render={triggerProps.trigger} />
      ) : (
        <DropdownMenuTrigger>
          {triggerProps.icon}
          {triggerProps.label}
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent className="w-64 p-1">
        <DropDownMenuDontEatMyKeydowns>{picker}</DropDownMenuDontEatMyKeydowns>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
