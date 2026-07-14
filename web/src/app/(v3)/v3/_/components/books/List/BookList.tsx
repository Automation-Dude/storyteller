"use client"

import { useVirtualizer } from "@tanstack/react-virtual"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@v3/_/components/ui/button"
import {
  FilterableMenu,
  FilterableMenuContent,
  FilterableMenuItem,
  FilterableMenuSeparator,
} from "@v3/_/components/ui/filterable-menu"
import { useGridNavigation } from "@v3/_/hooks/use-grid-navigation"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { ActionEntryList } from "@/app/(v3)/v3/_/components/books/ActionMenu/BookActionMenuItems"
import {
  findScrollParent,
  useBookActionMenu,
} from "@/app/(v3)/v3/_/components/books/ActionMenu/useBookActionMenu"
import { ColumnSelector } from "@/app/(v3)/v3/_/components/books/ColumnSelector"
import { SelectionBullet } from "@/app/(v3)/v3/_/components/books/SelectionCheckbox"
import {
  BOOK_COLLECTION_ID,
  BOOK_DETAIL_PANEL_ID,
  type BookNavModel,
  bookItemDomId,
} from "@/app/(v3)/v3/_/components/books/keyboard-nav"
import { type BookWithRelations } from "@/database/books"
import * as icon from "@/icons"
import {
  type DisplayField,
  type SortContext,
  type SortDirection,
  type SortField,
} from "@/sort"

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
  // temporary: which keyboard-open model the list uses (see LibraryPage toggle)
  navModel?: BookNavModel
}

export function BookList({
  books,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  showMuted,
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
  navModel = "commit",
  ...props
}: BookListProps) {
  const t = useTranslation("BookList")
  const menu = useBookActionMenu(books)

  const emptyMessage = props.emptyMessage ?? t("emptyState")
  const emptySubMessage = props.emptySubMessage ?? t("emptyStateSub")

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
  const tActions = useTranslation("BookActions")

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

  // keyboard navigation: focus stays on the list container, up/down move a
  // cursor, the active row is surfaced via aria-activedescendant. only wired
  // when the list is interactive.
  const navEnabled = !!onBookClick

  const openBookAt = useCallback(
    (index: number) => {
      const book = books[index]
      if (book) onBookClick?.(book)
    },
    [books, onBookClick],
  )

  const focusDetailPanel = useCallback(() => {
    requestAnimationFrame(() => {
      document.getElementById(BOOK_DETAIL_PANEL_ID)?.focus()
    })
  }, [])

  const nav = useGridNavigation({
    itemCount: books.length,
    columns: 1,
    enabled: navEnabled,
    getItemId: (index) => {
      const book = books[index]
      return book ? bookItemDomId(book.uuid) : undefined
    },
    scrollToIndex: (index) => {
      rowVirtualizer.scrollToIndex(index, { align: "auto" })
    },
    initialIndex: () => {
      const i = books.findIndex((b) => b.uuid === selectedBookUuid)
      return i >= 0 ? i : 0
    },
    onActiveChange:
      navModel === "preview"
        ? (index) => {
            openBookAt(index)
          }
        : undefined,
    onActivate: (index) => {
      openBookAt(index)
      focusDetailPanel()
    },
  })

  const activeUuid =
    nav.activeIndex !== null ? books[nav.activeIndex]?.uuid ?? null : null

  if (!isLoading && books.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[50vh] flex-col items-center justify-center gap-2">
        <icon.Search className="h-12 w-12 opacity-40" />
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
      <div className="border-border bg-surface-base sticky -top-6 z-10 -mx-6 flex items-center gap-3 border-b px-5 pb-1.5">
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
          id={BOOK_COLLECTION_ID}
          aria-label="Books"
          {...(navEnabled ? nav.containerProps : {})}
          className={cn(
            "animate-in fade-in-0 relative w-full py-4 transition-opacity duration-300 outline-none",
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
                  keyboardNav={navEnabled}
                  active={navEnabled && book.uuid === activeUuid}
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
          <icon.LoaderIOSish className="h-5 w-5 animate-spin" />
          <span>Loading more...</span>
        </div>
      )}

      <FilterableMenu handle={menu.handle}>
        <FilterableMenuContent
          searchable
          searchPlaceholder={tActions.plain("search")}
          align="end"
          className="pointer-events-auto z-100 w-fit"
          onClose={() => {
            menu.handle.close()
          }}
        >
          {menu.toggleSelection && menu.menuBook && (
            <>
              <FilterableMenuItem
                icon={<SelectionBullet selected={menu.menuBookIsSelected} />}
                textValue={
                  menu.menuBookIsSelected
                    ? c.plain("actions.deselect")
                    : c.plain("actions.select")
                }
                onSelect={() => {
                  menu.toggleSelection?.(menu.menuBook?.uuid ?? "")
                }}
              >
                {menu.menuBookIsSelected
                  ? c("actions.deselect")
                  : c("actions.select")}
              </FilterableMenuItem>
              <FilterableMenuSeparator />
            </>
          )}

          <ActionEntryList entries={menu.menuEntries} />
        </FilterableMenuContent>
      </FilterableMenu>

      {menu.menuDialogs}
    </>
  )
}
