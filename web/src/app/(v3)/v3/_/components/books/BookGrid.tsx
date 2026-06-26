"use client"

import { IconLoader, IconSearch } from "@tabler/icons-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { type BookWithRelations } from "@/database/books"
import { type GridCardSize } from "@/database/userPreferencesTypes"
import { type DisplayField, type SortContext } from "@/sort"

import { BookCard } from "@v3/_/components/books/BookCard"
import { BookCardSkeleton } from "@v3/_/components/books/BookCardSkeleton"
import { Button } from "@v3/_/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@v3/_/components/ui/dropdown-menu"
import { useUserPreferences } from "@v3/_/components/user-preferences-provider"
import { useOptionalBookSelection } from "@v3/_/hooks/use-book-selection"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { useBookActionItems } from "./BookActionMenuItems"

type BookGridProps = {
  books: BookWithRelations[]
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  fetchNextPage: () => void
  showMuted: boolean
  emptyMessage?: string | undefined
  emptySubMessage?: string | undefined
  onClearFilters?: () => void
  hasActiveFilters?: boolean
  selectedBookUuid?: string | null
  onBookClick?: (book: BookWithRelations) => void
  displayField?: DisplayField
  displayContext?: SortContext
}

// preset card widths (px) for the gridCardSize preference. exported so the
// sidebar/panel can snap their width to values that leave the grid a whole
// number of columns at the chosen card width (no trailing gap).
export const GRID_CARD_WIDTHS: Record<GridCardSize, number> = {
  smallest: 130,
  small: 155,
  medium: 180,
  large: 220,
  largest: 270,
}
export const BOOK_GRID_GAP = 16 // gap-4
const GAP = BOOK_GRID_GAP
const COVER_ASPECT = 16 / 13 // aspect-[13/16]
const TEXT_BLOCK_HEIGHT = 60 // author + 2-line title + spacing

// walks up the dom to the nearest scrollable ancestor so the virtualizer
// tracks the real scroll container (PageContent) rather than the window.
function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null
  while (el) {
    const overflowY = getComputedStyle(el).overflowY
    if (overflowY === "auto" || overflowY === "scroll") return el
    el = el.parentElement
  }
  return null
}

export function BookGrid({
  books,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  showMuted,
  emptyMessage = "No books found",
  emptySubMessage,
  onClearFilters,
  hasActiveFilters,
  selectedBookUuid,
  onBookClick,
  displayField,
  displayContext,
}: BookGridProps) {
  const selection = useOptionalBookSelection()
  const isSelecting = (selection?.selectedBooks.size ?? 0) > 0

  const isMobile = useIsMobile()
  const { gridCardSize } = useUserPreferences()
  const cardWidth = GRID_CARD_WIDTHS[gridCardSize]

  const observerRef = useRef<ResizeObserver | null>(null)
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // callback ref so measurement binds whenever the real grid container mounts.
  // a plain effect would run once against the loading skeleton (container null)
  // and never re-bind after data arrives, leaving the grid blank on cold reload.
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()

    if (!node) {
      observerRef.current = null
      return
    }

    setScrollElement(findScrollParent(node))
    setContainerWidth(node.offsetWidth)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setContainerWidth(entry.contentRect.width)
    })
    observer.observe(node)
    observerRef.current = observer
  }, [])

  // mobile shows one book per row regardless of width (and has no side panel).
  const columnCount = useMemo(() => {
    if (containerWidth === 0) return 0
    if (isMobile) return 2
    return Math.max(1, Math.floor((containerWidth + GAP) / (cardWidth + GAP)))
  }, [containerWidth, isMobile, cardWidth])

  // cards are a fixed width, so row height is constant per column count.
  const rowHeight = useMemo(() => {
    const colWidth = isMobile ? containerWidth / 2 || cardWidth : cardWidth
    return colWidth * COVER_ASPECT + TEXT_BLOCK_HEIGHT + GAP
  }, [isMobile, containerWidth, cardWidth])

  const rowCount = columnCount > 0 ? Math.ceil(books.length / columnCount) : 0

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElement,
    estimateSize: () => rowHeight,
    overscan: 4,
    // measure real row heights so variable-length titles never clip or overlap
    measureElement:
      typeof window !== "undefined"
        ? (element) => element.getBoundingClientRect().height
        : undefined,
    useFlushSync: false,
    directDomUpdates: true,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()

  // drive infinite loading from the virtualizer instead of a sentinel element
  const lastVirtualRowIndex = virtualRows.at(-1)?.index
  useEffect(() => {
    if (lastVirtualRowIndex === undefined) return
    if (
      lastVirtualRowIndex >= rowCount - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage()
    }
  }, [
    lastVirtualRowIndex,
    rowCount,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ])

  // keep the selected book anchored when the grid reflows. opening/resizing the
  // detail panel changes the column count, which moves every book to a new row;
  // without this you lose the book you just clicked. instead of animating to it
  // (slow, janky), we restore the book to the exact viewport offset it had
  // before the reflow, synchronously, so it snaps in a single frame.
  const anchorRef = useRef<{ uuid: string; viewportTop: number } | null>(null)
  const prevColumnCountRef = useRef(columnCount)

  // correction runs first: when the column count changes, move the scroll
  // position so the selected book keeps the viewport offset captured below.
  useLayoutEffect(() => {
    const prevCols = prevColumnCountRef.current
    prevColumnCountRef.current = columnCount

    if (prevCols === columnCount || columnCount === 0) return
    if (!scrollElement || !selectedBookUuid) return

    const anchor = anchorRef.current
    if (!anchor || anchor.uuid !== selectedBookUuid) return

    const index = books.findIndex((b) => b.uuid === selectedBookUuid)
    if (index < 0) return

    const newRow = Math.floor(index / columnCount)
    // rows are a near-constant height, so estimate the new row offset directly
    // rather than waiting for the virtualizer to measure.
    // eslint-disable-next-line react-compiler/react-compiler -- setting scrollTop on the real scroll node is intentional, not state mutation
    scrollElement.scrollTop = newRow * rowHeight - anchor.viewportTop
  }, [columnCount, scrollElement, selectedBookUuid, books, rowHeight])

  // capture runs after: remember where the selected book currently sits in the
  // viewport so the correction above can restore it on the next reflow.
  useLayoutEffect(() => {
    if (!scrollElement || !selectedBookUuid) {
      anchorRef.current = null
      return
    }
    const card = scrollElement.querySelector(
      `[data-book-uuid="${selectedBookUuid}"]`,
    )
    if (!card) return

    const viewTop = scrollElement.getBoundingClientRect().top
    const cardTop = card.getBoundingClientRect().top
    anchorRef.current = {
      uuid: selectedBookUuid,
      viewportTop: cardTop - viewTop,
    }
  })

  const orderedUuids = useMemo(() => books.map((b) => b.uuid), [books])

  const handleSelectRange = useCallback(
    (uuid: string) => {
      selection?.selectRange(uuid, orderedUuids)
    },
    [selection, orderedUuids],
  )

  // shared card menu: one instance, positioned at whichever card opened it
  const t = useTranslation("BookActions")
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuBook, setMenuBook] = useState<BookWithRelations | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const handleMenuOpenChange = useCallback(
    (
      open: boolean,
      eventDetails?: {
        reason?: string
        trigger?: EventTarget | null
        event?: Event | null
      },
    ) => {
      const isSiblingOpenClose =
        !open && eventDetails?.reason === "sibling-open"
      const shouldIgnoreSiblingOpenClose = isSiblingOpenClose && menuOpen
      if (shouldIgnoreSiblingOpenClose) {
        return
      }

      setMenuOpen(open)
    },
    [menuOpen],
  )

  const handleOpenMenu = useCallback(
    (book: BookWithRelations, anchor: HTMLElement) => {
      setMenuBook(book)
      setMenuAnchor(anchor)
      setMenuOpen(true)
    },
    [],
  )

  const { items: menuItems, dialogs: menuDialogs } = useBookActionItems({
    books: menuBook ? [menuBook] : [],
    mode: "single",
  })

  const menuBookIsSelected = menuBook
    ? selection?.isSelected(menuBook.uuid) ?? false
    : false

  if (isLoading) {
    return (
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: isMobile
            ? "minmax(0, 1fr)"
            : `repeat(auto-fill, ${cardWidth}px)`,
        }}
      >
        {Array.from({ length: 40 }).map((_, i) => (
          <BookCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[50vh] flex-col items-center justify-center gap-2">
        <IconSearch className="h-12 w-12 opacity-40" />
        <p className="text-lg font-medium">{emptyMessage}</p>
        {emptySubMessage && <p className="text-sm">{emptySubMessage}</p>}

        {hasActiveFilters && onClearFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="mt-2"
          >
            Clear Filters
          </Button>
        )}
      </div>
    )
  }

  const toggleSelection = selection?.toggleSelection

  return (
    <>
      <div
        ref={containerRef}
        className={cn(
          "relative w-full transition-opacity duration-200",
          showMuted && "opacity-60",
        )}
        style={{ height: rowVirtualizer.getTotalSize() }}
      >
        <div className="animate-in fade-in-0 duration-300">
          {virtualRows.map((virtualRow) => {
            const start = virtualRow.index * columnCount
            const rowBooks = books.slice(start, start + columnCount)

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="absolute top-0 left-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <div
                  className="grid gap-4 pb-4"
                  style={{
                    gridTemplateColumns: isMobile
                      ? `repeat(${columnCount}, minmax(0, 1fr))`
                      : `repeat(${columnCount}, ${cardWidth}px)`,
                  }}
                >
                  {rowBooks.map((book) => (
                    <BookCard
                      key={book.uuid}
                      book={book}
                      muted={showMuted}
                      selected={book.uuid === selectedBookUuid}
                      isSelecting={isSelecting}
                      isBookSelected={selection?.isSelected(book.uuid) ?? false}
                      onToggleSelection={toggleSelection}
                      onSelectRange={handleSelectRange}
                      onOpenMenu={handleOpenMenu}
                      isMenuOpen={menuOpen && menuBook?.uuid === book.uuid}
                      onClick={onBookClick}
                      displayField={displayField}
                      displayContext={displayContext}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {isFetchingNextPage && (
        <div className="text-muted-foreground mt-4 flex items-center justify-center gap-2">
          <IconLoader className="h-5 w-5 animate-spin" />
          <span>Loading more...</span>
        </div>
      )}

      <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
        <DropdownMenuContent
          align="end"
          className="pointer-events-auto z-100 min-w-44"
          anchor={menuAnchor}
        >
          {toggleSelection && menuBook && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  toggleSelection(menuBook.uuid)
                }}
              >
                {menuBookIsSelected ? t("deselect") : t("select")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {menuItems}
        </DropdownMenuContent>
      </DropdownMenu>

      {menuDialogs}
    </>
  )
}
