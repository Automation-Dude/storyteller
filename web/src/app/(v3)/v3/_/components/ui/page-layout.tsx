"use client"

import * as React from "react"
import { useCallback, useRef, useState } from "react"

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

const MIN_PANEL_WIDTH = 320
const MAX_PANEL_WIDTH = 800

function PagePanel({
  open,
  width,
  onWidthChange,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  open: boolean
  width: number
  onWidthChange?: (width: number) => void
}) {
  const [isResizing, setIsResizing] = useState(false)
  const liveWidth = useRef(width)
  const panelRef = useRef<HTMLDivElement>(null)

  // while dragging, the panel is lifted out of the flex flow (position: fixed)
  // and resizes live; a spacer holds its slot so the middle section keeps its
  // width and only reflows once on release. this keeps the live preview without
  // making the virtualized book grid re-layout on every frame.
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      liveWidth.current = width

      const startX = e.clientX
      const startWidth = width

      const handleMouseMove = (e: MouseEvent) => {
        const newWidth = Math.round(
          Math.max(
            MIN_PANEL_WIDTH,
            Math.min(MAX_PANEL_WIDTH, startWidth + (startX - e.clientX)),
          ),
        )

        liveWidth.current = newWidth

        if (panelRef.current) {
          panelRef.current.style.width = `${newWidth}px`
        }
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        onWidthChange?.(liveWidth.current)
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    },
    [width, onWidthChange],
  )

  return (
    <>
      {open && onWidthChange && (
        <div
          data-slot="page-panel-resize-handle"
          className="group relative z-10 flex w-0 items-stretch"
        >
          <div
            className="absolute top-0 bottom-0 -left-2 w-4 cursor-col-resize"
            onMouseDown={handleResizeStart}
          >
            <div
              className={cn("bg-border mx-auto h-full w-px transition-colors")}
            />
          </div>
        </div>
      )}

      {/* holds the flex slot while the panel is lifted out of flow, so the
          middle section keeps its width until the drag is committed */}
      {isResizing && (
        <div
          aria-hidden
          className="shrink-0"
          style={{ width: open ? width : 0 }}
        />
      )}

      <div
        ref={panelRef}
        data-slot="page-panel"
        className={cn(
          "overflow-hidden",
          isResizing && "fixed inset-y-0 right-0 z-40 border-l shadow-xl",
          className,
        )}
        style={{
          width: open ? width : 0,
          minWidth: isResizing ? 0 : open ? width : 0,
        }}
        {...props}
      >
        {open && <div className="flex h-full w-full flex-col">{children}</div>}
      </div>
    </>
  )
}

const MIN_SIDEBAR_WIDTH = 220
const MAX_SIDEBAR_WIDTH = 480

function PageSidebar({
  width,
  onWidthChange,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  width: number
  onWidthChange?: (width: number) => void
}) {
  const [isResizing, setIsResizing] = useState(false)
  const liveWidth = useRef(width)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // while dragging, the sidebar is lifted out of the flex flow (position: fixed)
  // and resizes live; a spacer holds its slot so the middle section keeps its
  // width and only reflows once on release.
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      liveWidth.current = width

      const startX = e.clientX
      const startWidth = width

      const handleMouseMove = (e: MouseEvent) => {
        const newWidth = Math.round(
          Math.max(
            MIN_SIDEBAR_WIDTH,
            Math.min(MAX_SIDEBAR_WIDTH, startWidth + (e.clientX - startX)),
          ),
        )

        liveWidth.current = newWidth

        if (sidebarRef.current) {
          sidebarRef.current.style.width = `${newWidth}px`
        }
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        onWidthChange?.(liveWidth.current)
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    },
    [width, onWidthChange],
  )

  return (
    <>
      {/* holds the flex slot while the sidebar is lifted out of flow */}
      {isResizing && <div aria-hidden className="shrink-0" style={{ width }} />}

      <div
        ref={sidebarRef}
        data-slot="page-sidebar"
        className={cn(
          "flex h-full flex-col overflow-y-auto",
          isResizing
            ? "fixed inset-y-0 left-0 z-50 shadow-xl"
            : "shrink-0 transition-[width,min-width] duration-300 ease-in-out",
          className,
        )}
        style={{
          width,
          minWidth: isResizing ? 0 : width,
        }}
        {...props}
      >
        <div className="flex h-full w-full flex-col">{children}</div>
      </div>

      {onWidthChange && (
        <div
          data-slot="page-sidebar-resize-handle"
          className="group relative z-10 flex w-0 items-stretch"
        >
          <div
            className="absolute top-0 -right-2 bottom-0 w-4 cursor-col-resize"
            onMouseDown={handleResizeStart}
          >
            <div
              className={cn("bg-border mx-auto h-full w-px transition-colors")}
            />
          </div>
        </div>
      )}
    </>
  )
}

export { PageContent, PageHeader, PageLayout, PageMain, PagePanel, PageSidebar }
