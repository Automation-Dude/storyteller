"use client"

import { createContext, useContext } from "react"

// whether the detail panel is currently being drag-resized. the book grid reads
// this to switch its virtualizer into live-resize mode (reflow columns
// continuously for immediate feedback) instead of the settle-then-reflow it uses
// for animated width changes (panel open/close, sidebar toggle). defaults false
// so a grid rendered outside a BookListLayout just uses the settle behavior.
const PanelDraggingContext = createContext(false)

export const PanelDraggingProvider = PanelDraggingContext.Provider

export function usePanelDragging(): boolean {
  return useContext(PanelDraggingContext)
}
