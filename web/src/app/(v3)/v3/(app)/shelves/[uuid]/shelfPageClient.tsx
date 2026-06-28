"use client"

import { parseAsString, useQueryState } from "nuqs"
import { useCallback, useMemo } from "react"

import { type BookWithRelations } from "@/database/books"
import {
  type DisplayField,
  type SortDirection,
  type SortField,
} from "@/sort"
import { useListShelfBooksQuery, useListUserShelvesQuery } from "@/store/api"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import {
  type BookView,
  selectBookView,
  selectListVisibleColumns,
  uiSettingsSlice,
} from "@/store/slices/uiSettingsSlice"
import { extractEmojiIcon } from "@/strings"
import { type UUID } from "@/uuid"

import { BookFilters, BookGrid } from "@v3/_/components/books"
import { BookList } from "@v3/_/components/books/BookList"
import { BookListLayout } from "@v3/_/components/books/BookListLayout"
import { filterBooksClientSide } from "@v3/_/components/library/filter-books-client"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { useReportPanel } from "@v3/_/hooks/use-report-panel"
import { useTranslation } from "@v3/_/hooks/use-translation"

export function ShelfPageClient({ shelfUuid }: { shelfUuid: UUID }) {
  const t = useTranslation("ShelfPage")
  const dispatch = useAppDispatch()
  const { isSelecting, toggleSelection } = useBookSelection()

  const bookView = useAppSelector(selectBookView)
  const listVisibleColumns = useAppSelector(selectListVisibleColumns)

  const handleBookViewChange = useCallback(
    (view: BookView) => {
      dispatch(uiSettingsSlice.actions.setBookView(view))
    },
    [dispatch],
  )

  const handleListColumnsChange = useCallback(
    (fields: DisplayField[]) => {
      dispatch(uiSettingsSlice.actions.setListVisibleColumns(fields))
    },
    [dispatch],
  )

  const [selectedBookUuid, setSelectedBookUuid] = useQueryState(
    "book",
    parseAsString,
  )
  const [, setReportMode] = useReportPanel()

  const { data: books = [], isLoading } = useListShelfBooksQuery({ shelfUuid })
  const { data: shelves = [] } = useListUserShelvesQuery()

  const shelf = shelves.find((s) => s.uuid === shelfUuid)
  const shelfName = shelf
    ? extractEmojiIcon(shelf.name).label || shelf.name
    : "Shelf"

  const {
    state: filterState,
    onChange: onFilterChange,
    isSearching,
    deferredSearch,
    activeFilterCount,
    clearFilters,
    filterPopoverOpen,
    setFilterPopoverOpen,
  } = useBookFilters()

  const handleColumnSort = useCallback(
    (field: SortField, direction: SortDirection) => {
      onFilterChange("sortField", field)
      onFilterChange("sortDirection", direction)
    },
    [onFilterChange],
  )

  const filteredBooks = useMemo(() => {
    if (books.length === 0) return []

    return filterBooksClientSide(books, {
      search: deferredSearch || undefined,
      sortField: filterState.sortField,
      sortDirection: filterState.sortDirection,
      mediaFilter: filterState.mediaFilter,
      statusFilter: filterState.statusFilter,
    })
  }, [books, deferredSearch, filterState])

  const bookUuids = useMemo(
    () => filteredBooks.map((b) => b.uuid),
    [filteredBooks],
  )

  const selectedBook = useMemo(
    () => filteredBooks.find((b) => b.uuid === selectedBookUuid),
    [filteredBooks, selectedBookUuid],
  )

  const showMuted = isSearching

  const handleBookClick = (book: BookWithRelations) => {
    if (isSelecting) {
      toggleSelection(book.uuid)
      return
    }

    void setReportMode(false)
    void setSelectedBookUuid(book.uuid)
  }

  // alignment grade/score cell opens the panel straight into the report.
  const handleColumnClick = (book: BookWithRelations) => {
    void setReportMode(true)
    void setSelectedBookUuid(book.uuid)
  }

  const handleClosePanel = () => {
    void setSelectedBookUuid(null)
    void setReportMode(false)
  }

  return (
    <BookListLayout
      headerBreadcrumbs={[{ label: shelfName }]}
      selectedBookUuid={selectedBookUuid}
      selectedBook={selectedBook}
      onClosePanel={handleClosePanel}
      allBookUuids={bookUuids}
    >
      <BookFilters
        className="pt-1"
        state={filterState}
        onChange={onFilterChange}
        filterPopoverOpen={filterPopoverOpen}
        setFilterPopoverOpen={setFilterPopoverOpen}
        bookView={bookView}
        onBookViewChange={handleBookViewChange}
      />

      <PageContent className="p-4">
        {bookView === "list" ? (
          <BookList
            books={filteredBooks}
            isLoading={isLoading}
            isFetchingNextPage={false}
            hasNextPage={false}
            fetchNextPage={() => {}}
            showMuted={showMuted}
            emptyMessage={t("emptyShelf")}
            emptySubMessage={
              deferredSearch || activeFilterCount > 0
                ? t("adjustFilters")
                : undefined
            }
            onClearFilters={clearFilters}
            hasActiveFilters={activeFilterCount > 0}
            selectedBookUuid={selectedBookUuid}
            onBookClick={handleBookClick}
            onColumnClick={handleColumnClick}
            visibleColumns={listVisibleColumns}
            onVisibleColumnsChange={handleListColumnsChange}
            sortField={filterState.sortField}
            sortDirection={filterState.sortDirection}
            onSortChange={handleColumnSort}
          />
        ) : (
          <BookGrid
            books={filteredBooks}
            isLoading={isLoading}
            isFetchingNextPage={false}
            hasNextPage={false}
            fetchNextPage={() => {}}
            showMuted={showMuted}
            emptyMessage={t("emptyShelf")}
            emptySubMessage={
              deferredSearch || activeFilterCount > 0
                ? t("adjustFilters")
                : undefined
            }
            onClearFilters={clearFilters}
            hasActiveFilters={activeFilterCount > 0}
            selectedBookUuid={selectedBookUuid}
            onBookClick={handleBookClick}
          />
        )}
      </PageContent>
    </BookListLayout>
  )
}
