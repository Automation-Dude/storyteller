"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// headless keyboard navigation over a (possibly virtualized) collection.
//
// dom focus stays on the container; the active item is tracked as an index and
// surfaced via aria-activedescendant, so the focused item can unmount (as it
// does under virtualization) without losing focus. arrow math is 2d via
// `columns` (pass 1 for a plain list). generalized from the virtual-focus
// pattern in ui/filterable-menu.tsx so the same primitive can later drive the
// app sidebar and the sidebar search.

type NavKey =
  | "ArrowRight"
  | "ArrowLeft"
  | "ArrowDown"
  | "ArrowUp"
  | "Home"
  | "End"

const NAV_KEYS: NavKey[] = [
  "ArrowRight",
  "ArrowLeft",
  "ArrowDown",
  "ArrowUp",
  "Home",
  "End",
]

function isNavKey(key: string): key is NavKey {
  return (NAV_KEYS as string[]).includes(key)
}

export type GridNavigationOptions = {
  itemCount: number
  // 1 for lists/sidebars, column count for a grid
  columns: number
  role?: string
  // maps an index to the dom id of that item (for aria-activedescendant)
  getItemId: (index: number) => string | undefined
  // keep the active item on screen (virtualizer.scrollToIndex of its row)
  scrollToIndex?: (index: number) => void
  // Enter/Space, and the "commit" action in general
  onActivate?: (index: number) => void
  // fires on every cursor move (drives the "preview follows focus" model)
  onActiveChange?: (index: number) => void
  // where the cursor lands the first time nav starts (e.g. the selected item)
  initialIndex?: () => number | null
  enabled?: boolean
}

export type GridNavigation = {
  activeIndex: number | null
  setActiveIndex: (index: number | null) => void
  isActive: (index: number) => boolean
  containerProps: {
    role: string
    tabIndex: number
    "aria-activedescendant": string | undefined
    onKeyDown: (event: React.KeyboardEvent) => void
    onFocus: (event: React.FocusEvent) => void
  }
}

export function useGridNavigation({
  itemCount,
  columns,
  role = "listbox",
  getItemId,
  scrollToIndex,
  onActivate,
  onActiveChange,
  initialIndex,
  enabled = true,
}: GridNavigationOptions): GridNavigation {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  // read callbacks at event time so the key handler never needs re-subscribing
  const cbRef = useRef({ onActivate, onActiveChange, scrollToIndex, initialIndex })
  cbRef.current = { onActivate, onActiveChange, scrollToIndex, initialIndex }

  // clamp when the collection shrinks (facet switch, filter change)
  useEffect(() => {
    setActiveIndex((current) => {
      if (current === null) return null
      if (itemCount === 0) return null
      return Math.min(current, itemCount - 1)
    })
  }, [itemCount])

  const move = useCallback(
    (next: number) => {
      if (itemCount === 0) return
      const clamped = Math.max(0, Math.min(itemCount - 1, next))
      setActiveIndex(clamped)
      cbRef.current.onActiveChange?.(clamped)
    },
    [itemCount],
  )

  // scroll from a post-commit effect, not inside move(): calling
  // virtualizer.scrollToIndex mid-keydown (before react commits the new index)
  // undershoots with dynamically-measured rows and drifts, so after a handful of
  // rows the active item lands outside overscan, unmounts, and nav looks dead.
  useEffect(() => {
    if (activeIndex === null) return
    cbRef.current.scrollToIndex?.(activeIndex)
  }, [activeIndex])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!enabled || itemCount === 0) return
      // ignore keys bubbling from inner focusables (card links, menu trigger) so
      // we don't hijack their Enter/arrows -- we only drive nav from the
      // container itself, which is where focus lives in the activedescendant model.
      if (event.target !== event.currentTarget) return

      const current = activeIndex

      // the first nav key just reveals the cursor at the initial position
      if (current === null) {
        if (!isNavKey(event.key)) return
        event.preventDefault()
        const init = cbRef.current.initialIndex?.() ?? 0
        move(event.key === "End" ? itemCount - 1 : event.key === "Home" ? 0 : init)
        return
      }

      switch (event.key) {
        case "ArrowRight":
          event.preventDefault()
          move(current + 1)
          return
        case "ArrowLeft":
          event.preventDefault()
          move(current - 1)
          return
        case "ArrowDown":
          event.preventDefault()
          move(current + columns)
          return
        case "ArrowUp":
          event.preventDefault()
          move(current - columns)
          return
        case "Home":
          event.preventDefault()
          move(0)
          return
        case "End":
          event.preventDefault()
          move(itemCount - 1)
          return
        case "Enter":
        case " ":
          event.preventDefault()
          cbRef.current.onActivate?.(current)
          return
      }
    },
    [enabled, itemCount, activeIndex, columns, move],
  )

  // landing in the collection shows the cursor without opening anything. guard
  // against focus bubbling up from inner links so clicking a card link doesn't
  // spuriously seed the cursor.
  const onFocus = useCallback(
    (event: React.FocusEvent) => {
      if (!enabled || itemCount === 0) return
      if (event.target !== event.currentTarget) return
      setActiveIndex((current) =>
        current !== null ? current : cbRef.current.initialIndex?.() ?? 0,
      )
    },
    [enabled, itemCount],
  )

  const isActive = useCallback(
    (index: number) => index === activeIndex,
    [activeIndex],
  )

  return {
    activeIndex,
    setActiveIndex,
    isActive,
    containerProps: {
      role,
      tabIndex: 0,
      "aria-activedescendant":
        activeIndex !== null ? getItemId(activeIndex) : undefined,
      onKeyDown,
      onFocus,
    },
  }
}
