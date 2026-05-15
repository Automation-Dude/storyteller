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
  toggleSelection: (uuid: string) => void
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

  const toggleSelection = useCallback((uuid: string) => {
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
  }, [])

  // having some selected books counts as selecting
  const isActuallySelcting = isSelecting || selectedBooks.size > 0

  const value = useMemo(
    () => ({
      selectedBooks,
      isSelecting: isActuallySelcting,
      toggleSelection,
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
      toggleSelection,
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
