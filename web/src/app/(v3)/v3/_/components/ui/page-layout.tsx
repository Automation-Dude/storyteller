"use client"

import * as React from "react"
import { useCallback, useState } from "react"

import { cn } from "@v3/_/lib/utils"

/**
 * composable page layout that supports a full-height side panel
 * with independent scrolling and resize capability.
 *
 * usage:
 *   <PageLayout>
 *     <PageMain>
 *       <PageHeader breadcrumbs={[...]} />
 *       <PageContent>
 *         ...scrollable content...
 *       </PageContent>
 *     </PageMain>
 *     <PagePanel open={open} width={400} onWidthChange={setWidth}>
 *       ...panel content...
 *     </PagePanel>
 *   </PageLayout>
 */

function PageLayout({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-layout"
      className={cn("flex h-screen overflow-hidden", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function PageMain({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-main"
      className={cn("flex min-w-0 flex-1 flex-col overflow-hidden", className)}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * flow-based wrapper around the absolutely-positioned SiteHeader,
 * so the header takes up space in the flex column instead of overlapping content.
 */
function PageHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header"
      className={cn("relative h-(--header-height) w-full shrink-0", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function PageContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-content"
      className={cn("scroll-y flex-1", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export const MIN_PANEL_WIDTH = 240
export const MAX_PANEL_WIDTH = 800

function PagePanel({
  open,
  width,
  onWidthChange,
  snapWidth,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  open: boolean
  width: number
  onWidthChange?: (width: number) => void
  // maps a raw dragged width to the nearest "clean" width (one that makes the
  // book grid fit a whole number of columns). drives the snap preview + commit.
  snapWidth?: (rawWidth: number) => number
}) {
  // the panel itself never animates -- it just jumps to its new width. while
  // dragging we don't touch the panel/grid at all; we only show a preview line
  // at the width it will snap to, and commit once on release. that keeps the
  // grid from reflowing on every frame and makes the result predictable.
  const [previewWidth, setPreviewWidth] = useState<number | null>(null)

  const clampWidth = useCallback(
    (w: number) => Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, w)),
    [],
  )

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()

      const startX = e.clientX
      const startWidth = width
      let committed = width

      const abortController = new AbortController()
      const handleMouseMove = (e: MouseEvent) => {
        const raw = clampWidth(startWidth + (startX - e.clientX))
        const snapped = clampWidth(snapWidth ? snapWidth(raw) : raw)
        committed = snapped
        setPreviewWidth(snapped)
      }

      const handleMouseUp = () => {
        abortController.abort()
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        setPreviewWidth(null)
        // single reflow: grid recomputes once, fades to the new column count.
        onWidthChange?.(committed)
      }

      document.addEventListener("mousemove", handleMouseMove, {
        signal: abortController.signal,
      })
      document.addEventListener("mouseup", handleMouseUp, {
        signal: abortController.signal,
      })
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    },
    [width, onWidthChange, snapWidth, clampWidth],
  )

  if (!open) return null

  return (
    <>
      {onWidthChange && (
        <div
          data-slot="page-panel-resize-handle"
          className="group relative z-30 flex w-0 items-stretch"
        >
          <div
            className="absolute top-0 bottom-0 -left-2 w-4 cursor-col-resize"
            onMouseDown={handleResizeStart}
          >
            <div className="bg-border group-hover:bg-primary/40 mx-auto h-full w-px transition-colors" />
          </div>
        </div>
      )}

      {/* snap preview: a line at the panel edge it will jump to on release */}
      {previewWidth !== null && (
        <div
          aria-hidden
          className="bg-primary pointer-events-none fixed inset-y-0 z-40 w-0.5"
          style={{ right: previewWidth }}
        />
      )}

      <div
        data-slot="page-panel"
        className={cn("bg-background shrink-0 overflow-hidden", className)}
        style={{ width }}
        {...props}
      >
        <div className="flex h-full w-full">{children}</div>
      </div>
    </>
  )
}

export const MIN_SIDEBAR_WIDTH = 180
export const MAX_SIDEBAR_WIDTH = 480

function PageSidebar({
  width,
  onWidthChange,
  snapWidth,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  width: number
  onWidthChange?: (width: number) => void
  snapWidth?: (rawWidth: number) => number
}) {
  const sidebarRef = React.useRef<HTMLDivElement>(null)
  const [previewLeft, setPreviewLeft] = useState<number | null>(null)

  const clampWidth = useCallback(
    (w: number) => Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, w)),
    [],
  )

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0

      const startX = e.clientX
      const startWidth = width
      let committed = width

      const abortController = new AbortController()
      const handleMouseMove = (e: MouseEvent) => {
        const raw = clampWidth(startWidth + (e.clientX - startX))
        const snapped = clampWidth(snapWidth ? snapWidth(raw) : raw)
        committed = snapped
        setPreviewLeft(sidebarLeft + snapped)
      }

      const handleMouseUp = () => {
        abortController.abort()
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        setPreviewLeft(null)
        onWidthChange?.(committed)
      }

      document.addEventListener("mousemove", handleMouseMove, {
        signal: abortController.signal,
      })
      document.addEventListener("mouseup", handleMouseUp, {
        signal: abortController.signal,
      })
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    },
    [width, onWidthChange, snapWidth, clampWidth],
  )

  return (
    <>
      <div
        ref={sidebarRef}
        data-slot="page-sidebar"
        className={cn(
          "bg-background border-border flex h-full shrink-0 flex-col overflow-y-auto border-r",
          className,
        )}
        style={{ width }}
        {...props}
      >
        <div className="flex h-full w-full flex-col">{children}</div>
      </div>

      {previewLeft !== null && (
        <div
          aria-hidden
          className="bg-primary pointer-events-none fixed inset-y-0 z-40 w-0.5"
          style={{ left: previewLeft }}
        />
      )}

      {onWidthChange && (
        <div
          data-slot="page-sidebar-resize-handle"
          className="group relative z-30 flex w-0 items-stretch"
        >
          <div
            className="absolute top-0 -right-2 bottom-0 w-4 cursor-col-resize"
            onMouseDown={handleResizeStart}
          >
            <div className="bg-border group-hover:bg-primary/40 mx-auto h-full w-px transition-colors" />
          </div>
        </div>
      )}
    </>
  )
}

export { PageContent, PageHeader, PageLayout, PageMain, PagePanel, PageSidebar }
