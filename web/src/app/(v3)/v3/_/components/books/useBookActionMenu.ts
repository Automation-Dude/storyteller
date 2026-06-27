"use client"

import { useCallback, useMemo, useState } from "react"

import { type BookWithRelations } from "@/database/books"

import { useOptionalBookSelection } from "@v3/_/hooks/use-book-selection"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { useBookActionItems } from "./BookActionMenuItems"

// walks up the dom to the nearest scrollable ancestor so the virtualizer
// tracks the real scroll container (PageContent) rather than the window.
export function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null

  while (el) {
    const overflowY = getComputedStyle(el).overflowY
    if (overflowY === "auto" || overflowY === "scroll") return el
    el = el.parentElement
  }

  return null
}

// shared menu and selection state used by both BookGrid and BookList.
// bundles the ellipsis-menu wiring, selection helpers, and the
// useBookActionItems call into a single hook so neither component
// duplicates any of it.
export function useBookActionMenu(books: BookWithRelations[]) {
  const selection = useOptionalBookSelection()
  const isSelecting = (selection?.selectedBooks.size ?? 0) > 0
  const toggleSelection = selection?.toggleSelection

  const orderedUuids = useMemo(() => books.map((b) => b.uuid), [books])

  const handleSelectRange = useCallback(
    (uuid: string) => {
      selection?.selectRange(uuid, orderedUuids)
    },
    [selection, orderedUuids],
  )

  const t = useTranslation("BookActions")

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
      // weird issue where the menu would get closed when the user hovered
      // over a submenu trigger -- the "sibling-open" reason fires even
      // though no sibling is actually opening.
      const isSiblingOpenClose =
        !open && eventDetails?.reason === "sibling-open"
      const shouldIgnore = isSiblingOpenClose && menuOpen

      if (shouldIgnore) {
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
    ? (selection?.isSelected(menuBook.uuid) ?? false)
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
  }
}
