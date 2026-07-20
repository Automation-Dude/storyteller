"use client"

import { useCallback, useMemo, useState } from "react"

import { type UUID } from "@/uuid"

export type SelectionState = {
  selected: Set<UUID>
  lastSelectedId: UUID | null
  toggle: (id: UUID) => void
  selectRange: (targetId: UUID, orderedIds: UUID[]) => void
  selectAll: (ids: UUID[]) => void
  selectNone: () => void
  invert: (allIds: UUID[]) => void
  isSelected: (id: UUID) => boolean
  // clear both the selection and the anchor
  reset: () => void
}

export function useSelectionState(): SelectionState {
  const [selected, setSelected] = useState<Set<UUID>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<UUID | null>(null)

  const toggle = useCallback((id: UUID) => {
    setLastSelectedId(id)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectRange = useCallback(
    (targetId: UUID, orderedIds: UUID[]) => {
      const anchorId = lastSelectedId

      if (!anchorId) {
        setLastSelectedId(targetId)
        setSelected((prev) => new Set([...prev, targetId]))
        return
      }

      const anchorIdx = orderedIds.indexOf(anchorId)
      const targetIdx = orderedIds.indexOf(targetId)

      if (anchorIdx === -1 || targetIdx === -1) {
        setLastSelectedId(targetId)
        setSelected((prev) => new Set([...prev, targetId]))
        return
      }

      const from = Math.min(anchorIdx, targetIdx)
      const to = Math.max(anchorIdx, targetIdx)
      const rangeIds = orderedIds.slice(from, to + 1)

      setLastSelectedId(targetId)
      setSelected((prev) => {
        const anchorIsSelected = prev.has(anchorId)
        const next = new Set(prev)

        for (const id of rangeIds) {
          if (anchorIsSelected) {
            next.add(id)
          } else {
            next.delete(id)
          }
        }

        return next
      })
    },
    [lastSelectedId],
  )

  const selectAll = useCallback((ids: UUID[]) => {
    setSelected(new Set(ids))
  }, [])

  const selectNone = useCallback(() => {
    setSelected(new Set())
  }, [])

  const invert = useCallback((allIds: UUID[]) => {
    setSelected((prev) => new Set(allIds.filter((id) => !prev.has(id))))
  }, [])

  const isSelected = useCallback((id: UUID) => selected.has(id), [selected])

  const reset = useCallback(() => {
    setSelected(new Set())
    setLastSelectedId(null)
  }, [])

  return useMemo(
    () => ({
      selected,
      lastSelectedId,
      toggle,
      selectRange,
      selectAll,
      selectNone,
      invert,
      isSelected,
      reset,
    }),
    [
      selected,
      lastSelectedId,
      toggle,
      selectRange,
      selectAll,
      selectNone,
      invert,
      isSelected,
      reset,
    ],
  )
}
