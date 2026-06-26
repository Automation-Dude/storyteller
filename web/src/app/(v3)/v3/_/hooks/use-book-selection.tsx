"use client"

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

type BookSelectionContextValue = {
  selectedBooks: Set<string>
  isSelecting: boolean
  lastSelectedUuid: string | null
  toggleSelection: (uuid: string) => void
  selectRange: (targetUuid: string, orderedUuids: string[]) => void
  selectAll: (uuids: string[]) => void
  selectNone: () => void
  invertSelection: (allUuids: string[]) => void
  isSelected: (uuid: string) => boolean
  startSelecting: () => void
  stopSelecting: () => void
}

const BookSelectionContext = createContext<BookSelectionContextValue | null>(
  null,
)

export function BookSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set())
  const [isSelecting, setIsSelecting] = useState(false)
  const [lastSelectedUuid, setLastSelectedUuid] = useState<string | null>(null)

  const toggleSelection = useCallback((uuid: string) => {
    setLastSelectedUuid(uuid)
    setSelectedBooks((prev) => {
      const next = new Set(prev)
      if (next.has(uuid)) {
        next.delete(uuid)
      } else {
        next.add(uuid)
      }
      return next
    })
  }, [])

  // toggle the inclusive range between the last-selected card and the target.
  // if the anchor was a deselect, the range deselects; if a select, it selects.
  const selectRange = useCallback(
    (targetUuid: string, orderedUuids: string[]) => {
      const anchorUuid = lastSelectedUuid

      if (!anchorUuid) {
        setLastSelectedUuid(targetUuid)
        setSelectedBooks((prev) => new Set([...prev, targetUuid]))
        return
      }

      const anchorIdx = orderedUuids.indexOf(anchorUuid)
      const targetIdx = orderedUuids.indexOf(targetUuid)

      if (anchorIdx === -1 || targetIdx === -1) {
        setLastSelectedUuid(targetUuid)
        setSelectedBooks((prev) => new Set([...prev, targetUuid]))
        return
      }

      const from = Math.min(anchorIdx, targetIdx)
      const to = Math.max(anchorIdx, targetIdx)
      const rangeUuids = orderedUuids.slice(from, to + 1)

      setLastSelectedUuid(targetUuid)
      setSelectedBooks((prev) => {
        // if the anchor book is currently selected, we're extending a selection;
        // if it was deselected, we're extending a deselection.
        const anchorIsSelected = prev.has(anchorUuid)
        const next = new Set(prev)

        for (const uuid of rangeUuids) {
          if (anchorIsSelected) {
            next.add(uuid)
          } else {
            next.delete(uuid)
          }
        }

        return next
      })
    },
    [lastSelectedUuid],
  )

  const selectAll = useCallback((uuids: string[]) => {
    setSelectedBooks(new Set(uuids))
  }, [])

  const selectNone = useCallback(() => {
    setSelectedBooks(new Set())
  }, [])

  const invertSelection = useCallback((allUuids: string[]) => {
    setSelectedBooks(
      (prev) => new Set(allUuids.filter((uuid) => !prev.has(uuid))),
    )
  }, [])

  const isSelected = useCallback(
    (uuid: string) => selectedBooks.has(uuid),
    [selectedBooks],
  )

  const startSelecting = useCallback(() => {
    setIsSelecting(true)
  }, [])

  const stopSelecting = useCallback(() => {
    setIsSelecting(false)
    setSelectedBooks(new Set())
    setLastSelectedUuid(null)
  }, [])

  // having some selected books counts as selecting
  const isActuallySelcting = isSelecting || selectedBooks.size > 0

  const value = useMemo(
    () => ({
      selectedBooks,
      isSelecting: isActuallySelcting,
      lastSelectedUuid,
      toggleSelection,
      selectRange,
      selectAll,
      selectNone,
      invertSelection,
      isSelected,
      startSelecting,
      stopSelecting,
    }),
    [
      selectedBooks,
      isActuallySelcting,
      lastSelectedUuid,
      toggleSelection,
      selectRange,
      selectAll,
      selectNone,
      invertSelection,
      isSelected,
      startSelecting,
      stopSelecting,
    ],
  )

  return (
    <BookSelectionContext.Provider value={value}>
      {children}
    </BookSelectionContext.Provider>
  )
}

export function useBookSelection() {
  const context = useContext(BookSelectionContext)
  if (!context) {
    throw new Error(
      "useBookSelection must be used within a BookSelectionProvider",
    )
  }
  return context
}

export function useOptionalBookSelection() {
  return useContext(BookSelectionContext)
}
