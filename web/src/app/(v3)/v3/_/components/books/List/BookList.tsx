"use client"

import { IconLoader, IconSearch } from "@tabler/icons-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@v3/_/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@v3/_/components/ui/dropdown-menu"
import { useCommon } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { type BookWithRelations } from "@/database/books"
import {
  type DisplayField,
  type SortContext,
  type SortDirection,
  type SortField,
} from "@/sort"

import {
  findScrollParent,
  useBookActionMenu,
} from "../ActionMenu/useBookActionMenu"
import { ColumnSelector } from "../ColumnSelector"
import { SelectionBullet } from "../SelectionCheckbox"
import {
  ColumnHeader,
  DEFAULT_COLUMNS,
  ESTIMATED_ROW_HEIGHT,
} from "./BookListColumns"
import { BookListItem, BookListItemSkeleton } from "./BookListItem"

type BookListProps = {
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
  // click on a specific column cell (e.g. the alignment grade) instead of the
  // row. when omitted, those cells fall through to the row click.
  onColumnClick?: (book: BookWithRelations, field: DisplayField) => void
  displayFields?: DisplayField[]
  displayContext?: SortContext
  visibleColumns?: DisplayField[]
  onVisibleColumnsChange?: (fields: DisplayField[]) => void
  sortField?: SortField
  sortDirection?: SortDirection
  onSortChange?: (field: SortField, direction: SortDirection) => void
}

export function BookList({
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
  onColumnClick,
  displayFields = ["authors"],
  displayContext,
  visibleColumns = DEFAULT_COLUMNS,
  onVisibleColumnsChange,
  sortField,
  sortDirection,
  onSortChange,
}: BookListProps) {
  const menu = useBookActionMenu(books)

  // the column headers that get their own column (not title/authors)
  const extraColumns = visibleColumns.filter(
    (f) => f !== "title" && f !== "authors",
  )

  // --- virtualization ---

  const observerRef = useRef<ResizeObserver | null>(null)
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()

    if (!node) {
      observerRef.current = null
      return
    }

    setScrollElement(findScrollParent(node))

    const observer = new ResizeObserver(() => {
      // we only need the scroll parent, no width tracking for a list
    })
    observer.observe(node)
    observerRef.current = observer
  }, [])

  const rowVirtualizer = useVirtualizer({
    count: books.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
    measureElement:
      typeof window !== "undefined"
        ? (element) => element.getBoundingClientRect().height
        : undefined,
    useFlushSync: false,
    directDomUpdates: true,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()

  const lastVirtualRowIndex = virtualRows.at(-1)?.index

  const c = useCommon()

  useEffect(() => {
    if (lastVirtualRowIndex === undefined) return

    if (
      lastVirtualRowIndex >= books.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage()
    }
  }, [
    lastVirtualRowIndex,
    books.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ])

  if (!isLoading && books.length === 0) {
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

  const translatedVisibleColumns = visibleColumns.map((field) => {
    return {
      field,
      label: c(`fields.short.${field}`),
    }
  })

  return (
    <>
      {/* column header row */}
      <div className="border-border bg-background sticky -top-4 z-10 -mx-4 flex items-center gap-3 border-b px-3 pb-1.5">
        {/* spacer for cover + title */}
        <div className="h-px w-10 shrink-0" />
        <div className="min-w-0 flex-1" />

        {extraColumns.length > 0 &&
          extraColumns.map((field) => (
            <ColumnHeader
              key={field}
              field={field}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
            />
          ))}
        <div className="flex w-[4rem] shrink-0 items-center justify-center">
          {onVisibleColumnsChange && (
            <ColumnSelector
              visibleFields={visibleColumns}
              onChange={onVisibleColumnsChange}
              className="h-4"
            />
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-px py-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <BookListItemSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div
          ref={containerRef}
          className={cn(
            "animate-in fade-in-0 relative w-full py-4 transition-opacity duration-300",
            showMuted && "opacity-60",
          )}
          style={{ height: rowVirtualizer.getTotalSize() }}
        >
          {virtualRows.map((virtualRow) => {
            const book = books[virtualRow.index]
            if (!book) return null

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="absolute top-1 left-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <BookListItem
                  book={book}
                  muted={showMuted}
                  handle={menu.handle}
                  selected={book.uuid === selectedBookUuid}
                  isSelecting={menu.isSelecting}
                  isBookSelected={
                    menu.selection?.isSelected(book.uuid) ?? false
                  }
                  onToggleSelection={menu.toggleSelection}
                  onSelectRange={menu.handleSelectRange}
                  onOpenMenu={menu.handleOpenMenu}
                  isMenuOpen={
                    menu.menuOpen && menu.menuBook?.uuid === book.uuid
                  }
                  onClick={onBookClick}
                  onColumnClick={onColumnClick}
                  displayFields={displayFields}
                  displayContext={displayContext}
                  visibleColumns={translatedVisibleColumns}
                />
              </div>
            )
          })}
        </div>
      )}

      {isFetchingNextPage && (
        <div className="text-muted-foreground mt-4 flex items-center justify-center gap-2">
          <IconLoader className="h-5 w-5 animate-spin" />
          <span>Loading more...</span>
        </div>
      )}

      <DropdownMenu handle={menu.handle}>
        <DropdownMenuContent
          align="end"
          className="pointer-events-auto z-100 w-fit"
          // anchor={menu.menuAnchor}
        >
          {menu.toggleSelection && menu.menuBook && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  menu.toggleSelection?.(menu.menuBook?.uuid ?? "")
                }}
              >
                <SelectionBullet selected={menu.menuBookIsSelected} />
                {menu.menuBookIsSelected
                  ? c("actions.deselect")
                  : c("actions.select")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {menu.menuItems}
        </DropdownMenuContent>
      </DropdownMenu>

      {menu.menuDialogs}
    </>
  )
}
