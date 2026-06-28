"use client"

import { IconAdjustmentsHorizontal, IconBookmarkPlus } from "@tabler/icons-react"
import { parseAsString, useQueryState } from "nuqs"
import { useCallback, useMemo, useState } from "react"

import { AddBookButton } from "@v3/_/components/AddBookButton"
import { BookFilters, BookGrid } from "@v3/_/components/books"
import { BookList } from "@v3/_/components/books/BookList"
import { BookListLayout } from "@v3/_/components/books/BookListLayout"
import { SaveAsShelfDialog } from "@v3/_/components/books/SaveAsShelfDialog"
import {
  ShelfFilterEditor,
  isFilterValid,
} from "@v3/_/components/shelves/ShelfFilterEditor"
import { Button } from "@v3/_/components/ui/button"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { useDebounce } from "@v3/_/hooks/use-debounce"
import { useReportPanel } from "@v3/_/hooks/use-report-panel"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type UserPermissionSet } from "@/database/users"
import { type ShelfFilterNode } from "@/shelves"
import {
  type DisplayField,
  type SortContext,
  type SortDirection,
  type SortField,
  deriveDisplayField,
} from "@/sort"
import { useListInfiniteBooksInfiniteQuery } from "@/store/api"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import {
  selectBookView,
  selectListVisibleColumns,
  uiSettingsSlice,
  type BookView,
} from "@/store/slices/uiSettingsSlice"
import { type UUID } from "@/uuid"

export default function BookPage({
  permissions: _permissions,
}: {
  permissions: UserPermissionSet
}) {
  const t = useTranslation("BooksPage")
  const dispatch = useAppDispatch()

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

  const { isSelecting, toggleSelection } = useBookSelection()

  const [selectedBookUuid, setSelectedBookUuid] = useQueryState(
    "book",
    parseAsString,
  )
  const [, setReportMode] = useReportPanel()

  const {
    state,
    onChange,
    queryArg,
    isSearching,
    deferredSearch,
    activeFilterCount,
    clearFilters,
    filterPopoverOpen,
    setFilterPopoverOpen,
    displayOverride,
    onDisplayOverrideChange,
  } = useBookFilters()

  const handleColumnSort = useCallback(
    (field: SortField, direction: SortDirection) => {
      onChange("sortField", field)
      onChange("sortDirection", direction)
    },
    [onChange],
  )

  // a series filter makes series position a meaningful secondary line
  const displayContext: SortContext = {
    seriesUuid: (state.seriesFilter as UUID | null) ?? null,
  }
  const displayField = deriveDisplayField(
    state.sortField,
    displayContext,
    displayOverride,
  )

  // opt-in advanced filter (the shelf filter tree). kept in page state rather
  // than the url; only a complete/valid tree is sent to the server, debounced.
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advancedFilter, setAdvancedFilter] = useState<ShelfFilterNode | null>(
    null,
  )
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const advancedFilterValid = isFilterValid(advancedFilter)
  const effectiveFilter = advancedFilterValid ? advancedFilter : undefined
  const debouncedFilter = useDebounce(effectiveFilter, 400)

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useListInfiniteBooksInfiniteQuery({
    ...queryArg,
    filter: debouncedFilter ?? undefined,
  })

  const books = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data?.pages],
  )

  const bookUuids = useMemo(() => books.map((b) => b.uuid), [books])

  const selectedBook = useMemo(
    () => books.find((b) => b.uuid === selectedBookUuid),
    [books, selectedBookUuid],
  )

  const showMuted =
    isSearching || (isFetching && !isFetchingNextPage && books.length > 0)

  const handleBookClick = (book: { uuid: string }) => {
    if (isSelecting) {
      toggleSelection(book.uuid)
      return
    }
    void setReportMode(false)
    void setSelectedBookUuid(book.uuid)
  }

  // clicking the alignment grade/score cell opens the panel straight into the
  // report rather than the book's details.
  const handleColumnClick = (book: { uuid: string }) => {
    void setReportMode(true)
    void setSelectedBookUuid(book.uuid)
  }

  const handleClosePanel = () => {
    void setSelectedBookUuid(null)
    void setReportMode(false)
  }

  return (
    <div
      style={
        {
          "--header-height": "6rem",
        } as React.CSSProperties
      }
    >
      <BookListLayout
        headerBreadcrumbs={[
          {
            render: (
              <h1 className="font-heading text-foreground truncate text-3xl font-normal">
                {t("title")}
              </h1>
            ),
          },
        ]}
        selectedBookUuid={selectedBookUuid}
        selectedBook={selectedBook}
        onClosePanel={handleClosePanel}
        allBookUuids={bookUuids}
        headerActions={[<AddBookButton key="add-book" />]}
      >
        <BookFilters
          state={state}
          onChange={onChange}
          filterPopoverOpen={filterPopoverOpen}
          setFilterPopoverOpen={setFilterPopoverOpen}
          showSaveSearch
          displayOverride={displayOverride}
          onDisplayOverrideChange={onDisplayOverrideChange}
          hasSeriesContext={!!state.seriesFilter}
          bookView={bookView}
          onBookViewChange={handleBookViewChange}
        />

        <div className="flex items-center gap-2 px-4 pt-1">
          <Button
            variant={showAdvanced || advancedFilterValid ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setShowAdvanced((v) => !v)
            }}
          >
            <IconAdjustmentsHorizontal className="mr-1 h-4 w-4" />
            Advanced filter
          </Button>

          {advancedFilterValid && advancedFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSaveDialogOpen(true)
              }}
            >
              <IconBookmarkPlus className="mr-1 h-4 w-4" />
              Save as shelf
            </Button>
          )}
        </div>

        {showAdvanced && (
          <div className="border-border border-b px-4 pt-2 pb-4">
            <ShelfFilterEditor
              filter={advancedFilter}
              onChange={setAdvancedFilter}
            />
          </div>
        )}

        {advancedFilter && (
          <SaveAsShelfDialog
            open={saveDialogOpen}
            onOpenChange={setSaveDialogOpen}
            filter={advancedFilter}
            sortField={state.sortField}
            sortDirection={state.sortDirection}
          />
        )}

        <PageContent className="p-4">
          {bookView === "list" ? (
            <BookList
              books={books}
              isLoading={isLoading}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
              fetchNextPage={fetchNextPage}
              showMuted={showMuted}
              emptySubMessage={
                deferredSearch || activeFilterCount > 0
                  ? "Try adjusting your search or filters"
                  : undefined
              }
              onClearFilters={clearFilters}
              hasActiveFilters={activeFilterCount > 0}
              selectedBookUuid={selectedBookUuid}
              onBookClick={handleBookClick}
              onColumnClick={handleColumnClick}
              displayField={displayField}
              displayContext={displayContext}
              visibleColumns={listVisibleColumns}
              onVisibleColumnsChange={handleListColumnsChange}
              sortField={state.sortField}
              sortDirection={state.sortDirection}
              onSortChange={handleColumnSort}
            />
          ) : (
            <BookGrid
              books={books}
              isLoading={isLoading}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
              fetchNextPage={fetchNextPage}
              showMuted={showMuted}
              emptySubMessage={
                deferredSearch || activeFilterCount > 0
                  ? "Try adjusting your search or filters"
                  : undefined
              }
              onClearFilters={clearFilters}
              hasActiveFilters={activeFilterCount > 0}
              selectedBookUuid={selectedBookUuid}
              onBookClick={handleBookClick}
              displayField={displayField}
              displayContext={displayContext}
            />
          )}
        </PageContent>
      </BookListLayout>
    </div>
  )
}
