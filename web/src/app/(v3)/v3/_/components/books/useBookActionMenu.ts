"use client"

import { useCallback, useMemo, useState } from "react"

import { useOptionalBookSelection } from "@v3/_/hooks/use-book-selection"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"

import { type BookWithRelations } from "@/database/books"

import { useBookActionItems } from "./BookActionMenuItems"

export function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null

  while (el) {
    const overflowY = getComputedStyle(el).overflowY
    if (overflowY === "auto" || overflowY === "scroll") return el
    el = el.parentElement
  }

  return null
}

export function useBookActionMenu(books: BookWithRelations[]) {
  const selection = useOptionalBookSelection()
  // single source of truth: the context's isSelecting already folds in
  // "explicit selection mode OR anything selected", so cards agree with the
  // toolbar even right after startSelecting() with nothing selected yet.
  const isSelecting = selection?.isSelecting ?? false
  const toggleSelection = selection?.toggleSelection

  const orderedUuids = useMemo(() => books.map((b) => b.uuid), [books])

  const handleSelectRange = useCallback(
    (uuid: string) => {
      selection?.selectRange(uuid, orderedUuids)
    },
    [selection, orderedUuids],
  )

  const t = useTranslation("BookActions")
  const c = useCommon()

  const [menuOpen, setMenuOpen] = useState(false)
  const [menuBook, setMenuBook] = useState<BookWithRelations | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const handleMenuOpenChange = useCallback(
    (
      open: boolean,
      eventDetails?: {
        reason?: string
        trigger?: EventTarget | null
        event?: Event | null
      },
    ) => {
      // the menu is anchored + opened programmatically (no real Trigger), which
      // breaks base-ui's hover/focus coordination with submenus: moving the
      // pointer into a submenu emits a transient close on the root and tears the
      // whole thing down. suppress those hover/focus closes and only honor an
      // explicit dismissal (escape, outside click, selecting an item).
      const transientCloseReasons = new Set([
        "sibling-open",
        "focus-out",
        "trigger-hover",
      ])
      const isTransientClose =
        !open &&
        menuOpen &&
        !!eventDetails?.reason &&
        transientCloseReasons.has(eventDetails.reason)

      if (isTransientClose) {
        return
      }

      setMenuOpen(open)
    },
    [menuOpen],
  )

  const handleOpenMenu = useCallback(
    (book: BookWithRelations, anchor: HTMLElement) => {
      setMenuBook(book)
      setMenuAnchor(anchor)
      setMenuOpen(true)
    },
    [],
  )

  const { items: menuItems, dialogs: menuDialogs } = useBookActionItems({
    books: menuBook ? [menuBook] : [],
    mode: "single",
  })

  const menuBookIsSelected = menuBook
    ? selection?.isSelected(menuBook.uuid) ?? false
    : false

  return {
    selection,
    isSelecting,
    toggleSelection,
    handleSelectRange,

    menuOpen,
    menuBook,
    menuAnchor,
    handleMenuOpenChange,
    handleOpenMenu,
    menuItems,
    menuDialogs,
    menuBookIsSelected,

    t,
    c,
  }
}
