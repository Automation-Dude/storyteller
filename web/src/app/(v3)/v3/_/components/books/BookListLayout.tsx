"use client"

import { useHotkey } from "@tanstack/react-hotkeys"
import dynamic from "next/dynamic"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { Drawer } from "vaul-base"

import { SiteHeader } from "@v3/_/components/site-header"
import {
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  PageHeader,
  PageLayout,
  PageMain,
  PagePanel,
  PageSidebar,
} from "@v3/_/components/ui/page-layout"
import { useUserPreferences } from "@v3/_/components/user-preferences-provider"
import { useIsMobile } from "@v3/_/hooks/use-mobile"

import { BookDetailsSkeleton } from "@/app/(v3)/v3/_/components/books/BookDetails/BookDetailsSkeleton"
import {
  BOOK_GRID_GAP,
  GRID_CARD_WIDTHS,
} from "@/app/(v3)/v3/_/components/books/Grid/BookGrid"
import {
  BOOK_COLLECTION_ID,
  BOOK_DETAIL_PANEL_ID,
} from "@/app/(v3)/v3/_/components/books/keyboard-nav"
import { type BookWithRelations } from "@/database/books"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import { uiSettingsSlice } from "@/store/slices/uiSettingsSlice"
import { type UUID } from "@/uuid"

const DynamicBookDetailsContent = dynamic(
  () =>
    import("@/app/(v3)/v3/_/components/books/BookDetails/BookDetailsPage").then(
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
  // step through the list from the panel. undefined at the list boundaries.
  nextBook?: () => void
  previousBook?: () => void
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
  nextBook,
  previousBook,
}: BookListLayoutProps) {
  const isMobile = useIsMobile()
  const dispatch = useAppDispatch()

  const focusCollection = useCallback(() => {
    document.getElementById(BOOK_COLLECTION_ID)?.focus()
  }, [])

  // "go to books": jump focus straight into the collection from anywhere,
  // alongside the skip link, so keyboard users never tab in through the chrome.
  useHotkey("G", focusCollection, { ignoreInputs: true })

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

  // the page sidebar is freely resizable between its min/max -- only the detail
  // panel snaps so the grid keeps whole columns.

  // re-snap the stored panel width so the grid starts with whole columns. runs
  // on mount, when the panel opens/closes, when the card size changes, or when
  // the layout resizes (window resize, app sidebar toggle).
  const snapRef = useRef({
    panelWidth,
    sidebarWidth,
    sidebar,
    dispatch,
  })
  snapRef.current = {
    panelWidth,
    sidebarWidth,
    sidebar,
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

    const { panelWidth, sidebarWidth, sidebar, dispatch } = snapRef.current
    const currentSidebar = sidebar ? sidebarWidth ?? 280 : 0

    if (panelOpen) {
      const snapped = snapChromeWidth(
        panelWidth,
        currentSidebar,
        MIN_PANEL_WIDTH,
        MAX_PANEL_WIDTH,
      )

      if (Math.abs(snapped - panelWidth) > 1) {
        dispatch(uiSettingsSlice.actions.setDetailPanelWidth(snapped))
      }
    }
  }, [panelOpen, cardWidth, layoutWidth, snapChromeWidth])

  // let the keyboard user step back out of the panel to the grid. Escape always
  // returns; plain Left is a bonus that must not fire when the focused control
  // wants the key itself (text fields, sliders, etc).
  const handlePanelKeyDown = useCallback((e: React.KeyboardEvent) => {
    const returnFocus = () => {
      document.getElementById(BOOK_COLLECTION_ID)?.focus()
    }

    if (e.key === "Escape") {
      e.preventDefault()
      returnFocus()
      return
    }

    if (e.key === "ArrowLeft") {
      const t = e.target as HTMLElement
      const tag = t.tagName
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable ||
        t.getAttribute("role") === "slider"
      ) {
        return
      }
      e.preventDefault()
      returnFocus()
    }
  }, [])

  if (isMobile) {
    return (
      <>
        <PageLayout>
          <PageMain>
            <SkipToBooksLink />
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
          nextBook={nextBook}
          previousBook={previousBook}
        />
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
            className="border-r"
          >
            {sidebar}
          </PageSidebar>
        )}

        <PageMain>
          <SkipToBooksLink />
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
            // focus target so keyboard-opening a book from the grid can move
            // focus into the panel (and the panel can hand focus back).
            <div
              id={BOOK_DETAIL_PANEL_ID}
              role="region"
              aria-label="Book details"
              tabIndex={-1}
              onKeyDown={handlePanelKeyDown}
              className="flex h-full w-full flex-col outline-none"
            >
              <DynamicBookDetailsContent
                uuid={selectedBookUuid as UUID}
                initialBook={selectedBook}
                compact
                onClose={onClosePanel}
                nextBook={nextBook}
                previousBook={previousBook}
              />
            </div>
          )}
        </PagePanel>
      </PageLayout>
    </>
  )
}

// standard bypass-blocks affordance: first tab stop on the page reveals a link
// that drops focus straight into the collection instead of walking the chrome.
function SkipToBooksLink() {
  return (
    <a
      href={`#${BOOK_COLLECTION_ID}`}
      onClick={(e) => {
        e.preventDefault()
        document.getElementById(BOOK_COLLECTION_ID)?.focus()
      }}
      className="bg-background focus:ring-primary sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:border focus:px-3 focus:py-2 focus:text-sm focus:shadow focus:ring-2 focus:outline-none"
    >
      Skip to books
    </a>
  )
}

export function BookDetailDrawer({
  selectedBookUuid,
  selectedBook,
  onClose,
  nextBook,
  previousBook,
}: {
  selectedBookUuid: string | null
  selectedBook?: BookWithRelations
  onClose: () => void
  nextBook?: () => void
  previousBook?: () => void
}) {
  return (
    <Drawer.Root
      open={!!selectedBookUuid}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />

        <Drawer.Content className="bg-background fixed right-0 bottom-0 left-0 z-40 flex h-[85svh] flex-col overflow-hidden rounded-t-2xl">
          <div
            id="book-detail-drawer-handle"
            className="bg-muted-foreground/20 relative z-10 mx-auto mt-4 -mb-6 h-1.5 w-12 shrink-0 rounded-full"
          />

          <Drawer.Title className="sr-only">Book Details</Drawer.Title>

          {selectedBookUuid && (
            <DynamicBookDetailsContent
              uuid={selectedBookUuid as UUID}
              initialBook={selectedBook}
              compact
              onClose={onClose}
              nextBook={nextBook}
              previousBook={previousBook}
            />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
