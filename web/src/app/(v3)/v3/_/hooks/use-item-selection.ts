"use client"

import { useCallback, useMemo, useState } from "react"

export type ItemSelectionState = {
  selectedItems: Set<string>
  isSelecting: boolean
  toggleItem: (key: string) => void
  selectAll: (keys: string[]) => void
  selectNone: () => void
  isSelected: (key: string) => boolean
  stopSelecting: () => void
}

export function useItemSelection(): ItemSelectionState {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  const toggleItem = useCallback((key: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev)

      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }

      return next
    })
  }, [])

  const selectAll = useCallback((keys: string[]) => {
    setSelectedItems(new Set(keys))
  }, [])

  const selectNone = useCallback(() => {
    setSelectedItems(new Set())
  }, [])

  const isSelected = useCallback(
    (key: string) => selectedItems.has(key),
    [selectedItems],
  )

  const stopSelecting = useCallback(() => {
    setSelectedItems(new Set())
  }, [])

  const isSelecting = selectedItems.size > 0

  return useMemo(
    () => ({
      selectedItems,
      isSelecting,
      toggleItem,
      selectAll,
      selectNone,
      isSelected,
      stopSelecting,
    }),
    [
      selectedItems,
      isSelecting,
      toggleItem,
      selectAll,
      selectNone,
      isSelected,
      stopSelecting,
    ],
  )
}
