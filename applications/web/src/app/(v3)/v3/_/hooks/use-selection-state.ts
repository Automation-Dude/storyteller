"use client"

import { useCallback, useMemo, useState } from "react"

// the reducer core shared by book selection (a page-wide context) and item
// selection (local sidebar state). both are "a Set of string ids with an anchor
// for shift-range"; only the delivery (context vs local) and the isSelecting
// semantics differ, so those live in the wrappers.
export type SelectionState = {
  selected: Set<string>
  lastSelectedId: string | null
  toggle: (id: string) => void
  selectRange: (targetId: string, orderedIds: string[]) => void
  selectAll: (ids: string[]) => void
  selectNone: () => void
  invert: (allIds: string[]) => void
  isSelected: (id: string) => boolean
  // clear both the selection and the anchor
  reset: () => void
}

export function useSelectionState(): SelectionState {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

  const toggle = useCallback((id: string) => {
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

  // toggle the inclusive range between the anchor (last-selected id) and the
  // target. if the anchor is currently selected the range selects, if it was
  // deselected the range deselects.
  const selectRange = useCallback(
    (targetId: string, orderedIds: string[]) => {
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

  const selectAll = useCallback((ids: string[]) => {
    setSelected(new Set(ids))
  }, [])

  const selectNone = useCallback(() => {
    setSelected(new Set())
  }, [])

  const invert = useCallback((allIds: string[]) => {
    setSelected((prev) => new Set(allIds.filter((id) => !prev.has(id))))
  }, [])

  const isSelected = useCallback((id: string) => selected.has(id), [selected])

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
