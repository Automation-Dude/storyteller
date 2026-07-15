"use client"

import { parseAsString, useQueryState } from "nuqs"
import { useCallback, useMemo } from "react"

import { BookFilters } from "@v3/_/components/books"
import { BookListLayout } from "@v3/_/components/books/BookListLayout"
import { BooksView } from "@v3/_/components/books/BooksView"
import { SelectionToolbar } from "@v3/_/components/books/SelectionToolbar"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { useReportPanel } from "@v3/_/hooks/use-report-panel"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type BookWithRelations } from "@/database/books"
import {
  type DisplayField,
  GENERAL_SORT_FIELDS,
  type SortContext,
  type SortDirection,
  type SortField,
  deriveDisplayFields,
} from "@/sort"
import { useListShelfBooksQuery, useListUserShelvesQuery } from "@/store/api"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import {
  selectGridDisplayFields,
  uiSettingsSlice,
} from "@/store/slices/uiSettingsSlice"
import { extractEmojiIcon } from "@/strings"
import { type UUID } from "@/uuid"

export function ShelfPageClient({ shelfUuid }: { shelfUuid: UUID }) {
  const t = useTranslation("ShelfPage")
  const tLabel = useTranslation("Common.fields.label")
  const dispatch = useAppDispatch()
  const { isSelecting, toggleSelection } = useBookSelection()

  const gridDisplayFields = useAppSelector(selectGridDisplayFields)

  const handleDisplayFieldsChange = useCallback(
    (fields: DisplayField[] | null) => {
      dispatch(uiSettingsSlice.actions.setGridDisplayFields(fields))
    },
    [dispatch],
  )

  const sortFieldOptions = useMemo<{ value: SortField; label: string }[]>(
    () => GENERAL_SORT_FIELDS.map((value) => ({ value, label: tLabel(value) })),
    [tLabel],
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

  const displayContext: SortContext = useMemo(() => ({ seriesUuid: null }), [])
  const displayFields = useMemo(
    () =>
      deriveDisplayFields(
        sort.field,
        effectiveFilter,
        displayContext,
        gridDisplayFields,
        controller.isDefaultSort,
      ),
    [
      sort.field,
      effectiveFilter,
      displayContext,
      gridDisplayFields,
      controller.isDefaultSort,
    ],
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
    >
      <BookFilters
        className="pt-1"
        controller={controller}
        sortOptions={sortFieldOptions}
        onSortChange={setSort}
        displayOverrides={gridDisplayFields}
        onDisplayOverridesChange={handleDisplayFieldsChange}
        currentFields={displayFields}
      />

      <PageContent className="p-6">
        <BooksView
          books={books}
          isLoading={isLoading}
          isFetchingNextPage={false}
          hasNextPage={false}
          fetchNextPage={() => {}}
          showMuted={showMuted}
          emptyMessage={t.plain("emptyShelf")}
          emptySubMessage={
            deferredSearch || activeFilterCount > 0
              ? t.plain("adjustFilters")
              : undefined
          }
          onClearFilters={clearAll}
          hasActiveFilters={activeFilterCount > 0}
          selectedBookUuid={selectedBookUuid}
          onBookClick={handleBookClick}
          onColumnClick={handleColumnClick}
          displayFields={displayFields}
          displayContext={displayContext}
          sortField={sort.field}
          sortDirection={sort.direction}
          onSortChange={handleColumnSort}
        />

        <SelectionToolbar allBooks={books} />
      </PageContent>
    </BookListLayout>
  )
}
