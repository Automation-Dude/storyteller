"use client"

import { parseAsString, useQueryState } from "nuqs"
import { useCallback, useMemo } from "react"

import { BookFilters, BookGrid } from "@v3/_/components/books"
import { BookList } from "@v3/_/components/books/BookList"
import { BookListLayout } from "@v3/_/components/books/BookListLayout"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { useReportPanel } from "@v3/_/hooks/use-report-panel"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type BookWithRelations } from "@/database/books"
import { type DisplayField, type SortDirection, type SortField } from "@/sort"
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

  const { data: shelves = [] } = useListUserShelvesQuery()

  const shelf = shelves.find((s) => s.uuid === shelfUuid)
  const shelfName = shelf
    ? extractEmojiIcon(shelf.name).label || shelf.name
    : "Shelf"

  const controller = useBookFilters()
  const {
    effectiveFilter,
    sort,
    setSort,
    isSearching,
    deferredSearch,
    activeFilterCount,
    clearAll,
  } = controller

  // the shelf's own books (manual + saved filter) with the page's quick /
  // advanced filter + search + sort applied server-side.
  const { data: books = [], isLoading } = useListShelfBooksQuery({
    shelfUuid,
    sortField: sort.field,
    orderDirection: sort.direction,
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(effectiveFilter ? { filter: effectiveFilter } : {}),
  })

  const handleColumnSort = useCallback(
    (field: SortField, direction: SortDirection) => {
      setSort(field, direction)
    },
    [setSort],
  )

  const bookUuids = useMemo(() => books.map((b) => b.uuid), [books])

  const selectedBook = useMemo(
    () => books.find((b) => b.uuid === selectedBookUuid),
    [books, selectedBookUuid],
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
        controller={controller}
        bookView={bookView}
        onBookViewChange={handleBookViewChange}
      />

      <PageContent className="p-4">
        {bookView === "list" ? (
          <BookList
            books={books}
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
            onClearFilters={clearAll}
            hasActiveFilters={activeFilterCount > 0}
            selectedBookUuid={selectedBookUuid}
            onBookClick={handleBookClick}
            onColumnClick={handleColumnClick}
            visibleColumns={listVisibleColumns}
            onVisibleColumnsChange={handleListColumnsChange}
            sortField={sort.field}
            sortDirection={sort.direction}
            onSortChange={handleColumnSort}
          />
        ) : (
          <BookGrid
            books={books}
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
            onClearFilters={clearAll}
            hasActiveFilters={activeFilterCount > 0}
            selectedBookUuid={selectedBookUuid}
            onBookClick={handleBookClick}
          />
        )}
      </PageContent>
    </BookListLayout>
  )
}
