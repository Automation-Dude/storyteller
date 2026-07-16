"use client"

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import { useSelectionState } from "@v3/_/hooks/use-selection-state"

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
  const selection = useSelectionState()
  // unlike the sidebar, book selection has an explicit mode: startSelecting()
  // enters it before anything is picked, so the toolbar can show up first.
  const [isSelectingMode, setIsSelectingMode] = useState(false)

  const startSelecting = useCallback(() => {
    setIsSelectingMode(true)
  }, [])

  const { reset } = selection
  const stopSelecting = useCallback(() => {
    setIsSelectingMode(false)
    reset()
  }, [reset])

  // explicit mode OR anything selected counts as selecting
  const isSelecting = isSelectingMode || selection.selected.size > 0

  const value = useMemo(
    () => ({
      selectedBooks: selection.selected,
      isSelecting,
      lastSelectedUuid: selection.lastSelectedId,
      toggleSelection: selection.toggle,
      selectRange: selection.selectRange,
      selectAll: selection.selectAll,
      selectNone: selection.selectNone,
      invertSelection: selection.invert,
      isSelected: selection.isSelected,
      startSelecting,
      stopSelecting,
    }),
    [selection, isSelecting, startSelecting, stopSelecting],
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
