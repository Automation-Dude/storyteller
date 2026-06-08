"use client"

import dynamic from "next/dynamic"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { Drawer } from "vaul"

import { BookDetailsSkeleton } from "@v3/_/components/books/BookDetailsSkeleton"
import {
  BOOK_GRID_GAP,
  GRID_CARD_WIDTHS,
} from "@v3/_/components/books/BookGrid"
import { SelectionToolbar } from "@v3/_/components/books/SelectionToolbar"
import { SiteHeader } from "@v3/_/components/site-header"
import {
  MAX_PANEL_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_PANEL_WIDTH,
  MIN_SIDEBAR_WIDTH,
  PageHeader,
  PageLayout,
  PageMain,
  PagePanel,
  PageSidebar,
} from "@v3/_/components/ui/page-layout"
import { useUserPreferences } from "@v3/_/components/user-preferences-provider"
import { useIsMobile } from "@v3/_/hooks/use-mobile"

import { type BookWithRelations } from "@/database/books"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import { uiSettingsSlice } from "@/store/slices/uiSettingsSlice"
import { type UUID } from "@/uuid"

const DynamicBookDetailsContent = dynamic(
  () =>
    import("@v3/_/components/books/BookDetailsPage").then(
      (mod) => mod.BookDetailsContent,
    ),
  {
    ssr: false,
    loading: () => <BookDetailsSkeleton compact={true} />,
  },
)

type BookListLayoutProps = {
  sidebar?: ReactNode
  sidebarWidth?: number
  onSidebarWidthChange?: (width: number) => void

  headerBreadcrumbs: ({ label: string; url?: string } | { render: ReactNode })[]
  headerActions?: ReactNode

  children: ReactNode

  selectedBookUuid: string | null
  // the matching row from the list query. forwarded to the detail content,
  // which seeds the getBook cache from it so the panel needs no extra fetch.
  selectedBook?: BookWithRelations
  onClosePanel: () => void

  allBookUuids?: string[]
}

export function BookListLayout({
  sidebar,
  sidebarWidth,
  onSidebarWidthChange,
  headerBreadcrumbs,
  headerActions,
  children,
  selectedBookUuid,
  selectedBook,
  onClosePanel,
  allBookUuids,
}: BookListLayoutProps) {
  const isMobile = useIsMobile()
  const dispatch = useAppDispatch()

  const panelWidth = useAppSelector(
    (state) => state.uiSettings.detailPanelWidth,
  )

  const panelOpen = !!selectedBookUuid

  const handlePanelWidthChange = useCallback(
    (width: number) => {
      dispatch(uiSettingsSlice.actions.setDetailPanelWidth(width))
    },
    [dispatch],
  )

  const { gridCardSize } = useUserPreferences()
  const cardWidth = GRID_CARD_WIDTHS[gridCardSize]
  const pageLayoutRef = useRef<HTMLDivElement>(null)

  const GRID_PADDING = 32 // PageContent p-4 (16px each side)

  // snap a resizable chrome (sidebar or panel) so the grid in the middle holds
  // a whole number of columns at the current card width. returns a width within
  // [minW, maxW] that leaves the grid a whole number of columns wide.
  const snapChromeWidth = useCallback(
    (rawWidth: number, otherChrome: number, minW: number, maxW: number) => {
      const layoutWidth =
        pageLayoutRef.current?.offsetWidth ?? window.innerWidth

      const pitch = cardWidth + BOOK_GRID_GAP
      const available = layoutWidth - otherChrome - GRID_PADDING

      const gridWidth = available - rawWidth
      const idealCols = Math.max(
        1,
        Math.round((gridWidth + BOOK_GRID_GAP) / pitch),
      )

      // walk outward from the ideal column count until we find one whose
      // chrome width falls within [minW, maxW]. at most one step needed
      // in each direction since the pitch is large relative to the bounds.
      for (let delta = 0; delta <= idealCols; delta++) {
        for (const d of delta === 0 ? [0] : [-delta, delta]) {
          const cols = idealCols + d
          if (cols < 1) continue

          const chrome = available - (cols * pitch - BOOK_GRID_GAP)
          if (chrome >= minW && chrome <= maxW) return chrome
        }
      }

      return Math.max(
        minW,
        Math.min(maxW, available - (idealCols * pitch - BOOK_GRID_GAP)),
      )
    },
    [cardWidth, GRID_PADDING],
  )

  const snapPanelWidth = useCallback(
    (raw: number) =>
      snapChromeWidth(
        raw,
        sidebar ? sidebarWidth ?? 280 : 0,
        MIN_PANEL_WIDTH,
        MAX_PANEL_WIDTH,
      ),
    [snapChromeWidth, sidebar, sidebarWidth],
  )

  const snapSidebarWidth = useCallback(
    (raw: number) =>
      snapChromeWidth(
        raw,
        panelOpen ? panelWidth : 0,
        MIN_SIDEBAR_WIDTH,
        MAX_SIDEBAR_WIDTH,
      ),
    [snapChromeWidth, panelOpen, panelWidth],
  )

  // re-snap stored widths so the grid starts with whole columns. runs on mount,
  // when the panel opens/closes, when the card size changes, or when the layout
  // resizes (window resize, app sidebar toggle).
  // snaps sequentially: panel first, then sidebar using the snapped panel width,
  // so they don't race each other with stale cross-references.
  const snapRef = useRef({
    panelWidth,
    sidebarWidth,
    sidebar,
    onSidebarWidthChange,
    dispatch,
  })
  snapRef.current = {
    panelWidth,
    sidebarWidth,
    sidebar,
    onSidebarWidthChange,
    dispatch,
  }

  const [layoutWidth, setLayoutWidth] = useState(0)

  useEffect(() => {
    const el = pageLayoutRef.current
    if (!el) return

    setLayoutWidth(el.offsetWidth)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setLayoutWidth(Math.round(entry.contentRect.width))
    })

    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (layoutWidth === 0) return

    const {
      panelWidth,
      sidebarWidth,
      sidebar,
      onSidebarWidthChange,
      dispatch,
    } = snapRef.current
    const currentSidebar = sidebar ? sidebarWidth ?? 280 : 0

    // snap the panel first so the sidebar snap uses the correct panel width
    let effectivePanelWidth = panelOpen ? panelWidth : 0

    if (panelOpen) {
      const snapped = snapChromeWidth(
        panelWidth,
        currentSidebar,
        MIN_PANEL_WIDTH,
        MAX_PANEL_WIDTH,
      )
      effectivePanelWidth = snapped

      if (Math.abs(snapped - panelWidth) > 1) {
        dispatch(uiSettingsSlice.actions.setDetailPanelWidth(snapped))
      }
    }

    if (sidebar && onSidebarWidthChange) {
      const snapped = snapChromeWidth(
        currentSidebar,
        effectivePanelWidth,
        MIN_SIDEBAR_WIDTH,
        MAX_SIDEBAR_WIDTH,
      )

      if (Math.abs(snapped - currentSidebar) > 1) {
        onSidebarWidthChange(snapped)
      }
    }
  }, [panelOpen, cardWidth, layoutWidth, snapChromeWidth])

  const selectionToolbar = allBookUuids ? (
    <SelectionToolbar allBookUuids={allBookUuids} />
  ) : null

  if (isMobile) {
    return (
      <>
        <PageLayout>
          <PageMain>
            <PageHeader>
              <SiteHeader
                breadcrumbs={headerBreadcrumbs}
                actions={headerActions}
              />
            </PageHeader>

            {children}
          </PageMain>
        </PageLayout>

        <BookDetailDrawer
          selectedBookUuid={selectedBookUuid}
          selectedBook={selectedBook}
          onClose={onClosePanel}
        />

        {selectionToolbar}
      </>
    )
  }

  return (
    <>
      <PageLayout ref={pageLayoutRef}>
        {sidebar && (
          <PageSidebar
            width={sidebarWidth ?? 280}
            {...(onSidebarWidthChange && {
              onWidthChange: onSidebarWidthChange,
            })}
            snapWidth={snapSidebarWidth}
            className="border-r"
          >
            {sidebar}
          </PageSidebar>
        )}

        <PageMain>
          <PageHeader>
            <SiteHeader
              breadcrumbs={headerBreadcrumbs}
              actions={headerActions}
            />
          </PageHeader>

          {children}
        </PageMain>

        <PagePanel
          open={panelOpen}
          width={panelWidth}
          onWidthChange={handlePanelWidthChange}
          snapWidth={snapPanelWidth}
          className="border-l"
        >
          {selectedBookUuid && (
            <DynamicBookDetailsContent
              canEdit
              uuid={selectedBookUuid as UUID}
              initialBook={selectedBook}
              compact
              onClose={onClosePanel}
            />
          )}
        </PagePanel>
      </PageLayout>

      {selectionToolbar}
    </>
  )
}

export function BookDetailDrawer({
  selectedBookUuid,
  selectedBook,
  onClose,
}: {
  selectedBookUuid: string | null
  selectedBook?: BookWithRelations
  onClose: () => void
}) {
  return (
    <Drawer.Root
      open={!!selectedBookUuid}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />

        <Drawer.Content className="bg-background fixed right-0 bottom-0 left-0 z-50 flex max-h-[85svh] flex-col overflow-clip rounded-t-2xl">
          <div className="bg-muted-foreground/20 mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full" />

          <Drawer.Title className="sr-only">Book Details</Drawer.Title>

          <div className="scroll-y flex-1 px-0 pb-8">
            {selectedBookUuid && (
              <DynamicBookDetailsContent
                uuid={selectedBookUuid as UUID}
                initialBook={selectedBook}
                compact
                onClose={onClose}
              />
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
