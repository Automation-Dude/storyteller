"use client"

import { IconLoader, IconSearch } from "@tabler/icons-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { BookCard } from "@v3/_/components/books/BookCard"
import { BookCardSkeleton } from "@v3/_/components/books/BookCardSkeleton"
import { Button } from "@v3/_/components/ui/button"
import { useUserPreferences } from "@v3/_/components/user-preferences-provider"
import { useOptionalBookSelection } from "@v3/_/hooks/use-book-selection"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { cn } from "@v3/_/lib/utils"

import { type BookWithRelations } from "@/database/books"
import { type GridCardSize } from "@/database/userPreferencesTypes"

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
    if (isMobile) return 1
    return Math.max(1, Math.floor((containerWidth + GAP) / (cardWidth + GAP)))
  }, [containerWidth, isMobile, cardWidth])

  // cards are a fixed width, so row height is constant per column count.
  const rowHeight = useMemo(() => {
    const colWidth = isMobile ? containerWidth || cardWidth : cardWidth
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

  // // column count or card size changing invalidates cached row heights
  // useEffect(() => {
  //   rowVirtualizer.measure()
  // }, [columnCount, rowHeight, rowVirtualizer])

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

  // keep the selected book in view when the grid reflows. opening/resizing the
  // detail panel changes the column count, which moves every book to a new row;
  // without this you lose the book you just clicked far up or down the list.
  // but only scroll when the book is *fully* off-screen -- moving the viewport
  // when the book is already (even partially) visible is jarring.
  // const prevColumnCount = useRef(columnCount)
  // const prevSelected = useRef(selectedBookUuid)
  // useEffect(() => {
  //   const columnChanged = prevColumnCount.current !== columnCount
  //   const selectionChanged = prevSelected.current !== selectedBookUuid
  //   prevColumnCount.current = columnCount
  //   prevSelected.current = selectedBookUuid

  //   if (!selectedBookUuid || columnCount === 0 || !scrollElement) return
  //   if (!columnChanged && !selectionChanged) return

  //   const index = books.findIndex((b) => b.uuid === selectedBookUuid)
  //   if (index < 0) return

  //   // if the card is rendered and any part of it is within the viewport, leave
  //   // the scroll position alone.
  //   const card = scrollElement.querySelector(
  //     `[data-book-uuid="${selectedBookUuid}"]`,
  //   )
  //   if (card) {
  //     const view = scrollElement.getBoundingClientRect()
  //     const rect = card.getBoundingClientRect()
  //     const partiallyVisible = rect.bottom > view.top && rect.top < view.bottom
  //     if (partiallyVisible) return
  //   }

  //   Math.floor(index / columnCount),
  //     {
  //       align: "center",
  //       behavior: "instant",
  //     }
  // }, [columnCount, selectedBookUuid, books, rowVirtualizer, scrollElement])

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
                      ? "minmax(0, 1fr)"
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
                      onClick={onBookClick}
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
    </>
  )
}
