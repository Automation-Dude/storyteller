"use client"

import { IconLoader, IconSearch } from "@tabler/icons-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { BookCard } from "@v3/_/components/books/BookCard"
import { BookCardSkeleton } from "@v3/_/components/books/BookCardSkeleton"
import { Button } from "@v3/_/components/ui/button"
import { useOptionalBookSelection } from "@v3/_/hooks/use-book-selection"
import { cn } from "@v3/_/lib/utils"

import { type BookWithRelations } from "@/database/books"

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

// keep in sync with the grid styling below
const GAP = 16 // gap-4
const MIN_COL_WIDTH = 160 // minmax(160px, 1fr)
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

  const columnCount = useMemo(() => {
    if (containerWidth === 0) return 0
    return Math.max(
      1,
      Math.floor((containerWidth + GAP) / (MIN_COL_WIDTH + GAP)),
    )
  }, [containerWidth])

  const estimatedRowHeight = useMemo(() => {
    if (columnCount === 0)
      return MIN_COL_WIDTH * COVER_ASPECT + TEXT_BLOCK_HEIGHT
    const colWidth = (containerWidth - GAP * (columnCount - 1)) / columnCount
    return colWidth * COVER_ASPECT + TEXT_BLOCK_HEIGHT + GAP
  }, [columnCount, containerWidth])

  const rowCount = columnCount > 0 ? Math.ceil(books.length / columnCount) : 0

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElement,
    estimateSize: () => estimatedRowHeight,
    overscan: 4,
    // measure real row heights so variable-length titles never clip or overlap
    measureElement:
      typeof window !== "undefined" && !navigator.userAgent.includes("Firefox")
        ? (element) => element.getBoundingClientRect().height
        : undefined,
  })

  // column count changing (resize / panel toggle) invalidates cached heights
  useEffect(() => {
    rowVirtualizer.measure()
  }, [columnCount, rowVirtualizer])

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

  if (isLoading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
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
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
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

      {isFetchingNextPage && (
        <div className="text-muted-foreground mt-4 flex items-center justify-center gap-2">
          <IconLoader className="h-5 w-5 animate-spin" />
          <span>Loading more...</span>
        </div>
      )}
    </>
  )
}
