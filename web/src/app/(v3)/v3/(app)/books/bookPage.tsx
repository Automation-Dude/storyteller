"use client"

import { parseAsString, useQueryState } from "nuqs"
import { useCallback, useMemo, useState } from "react"

import { AddBookButton } from "@v3/_/components/AddBookButton"
import { BookFilters, BookGrid } from "@v3/_/components/books"
import { BookList } from "@/app/(v3)/v3/_/components/books/List/BookList"
import { BookListLayout } from "@v3/_/components/books/BookListLayout"
import { SaveAsShelfDialog } from "@v3/_/components/books/SaveAsShelfDialog"
import { SelectionToolbar } from "@v3/_/components/books/SelectionToolbar"
import { ShelfFilterEditor } from "@v3/_/components/shelves/ShelfFilterEditor"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { useReportPanel } from "@v3/_/hooks/use-report-panel"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type UserPermissionSet } from "@/database/users"
import {
  type DisplayField,
  type SortContext,
  type SortDirection,
  type SortField,
  deriveDisplayFields,
} from "@/sort"
import { useListInfiniteBooksInfiniteQuery } from "@/store/api"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import {
  type BookView,
  selectBookView,
  selectListVisibleColumns,
  uiSettingsSlice,
} from "@/store/slices/uiSettingsSlice"

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

  const controller = useBookFilters()
  const {
    queryArg,
    effectiveFilter,
    userFilter,
    setUserFilter,
    sort,
    setSort,
    displayOverrides,
    isSearching,
    deferredSearch,
    activeFilterCount,
    clearAll,
  } = controller

  const handleColumnSort = useCallback(
    (field: SortField, direction: SortDirection) => {
      setSort(field, direction)
    },
    [setSort],
  )

  // the books page has no single-series context; position is not offered.
  const displayContext: SortContext = useMemo(() => ({ seriesUuid: null }), [])
  const displayFields = deriveDisplayFields(
    sort.field,
    displayContext,
    displayOverrides,
  )

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  // a tree too complex for the quick chips always shows the builder so it is
  // never hidden; otherwise the toggle controls it.
  const advancedVisible = showAdvanced || controller.isAdvanced

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useListInfiniteBooksInfiniteQuery(queryArg)

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

  const handleColumnClick = (book: { uuid: string }) => {
    void setReportMode(true)
    void setSelectedBookUuid(book.uuid)
  }

  const handleClosePanel = () => {
    void setSelectedBookUuid(null)
    void setReportMode(false)
  }

  const emptySubMessage =
    deferredSearch || activeFilterCount > 0
      ? "Try adjusting your search or filters"
      : undefined

  return (
    <div style={{ "--header-height": "6rem" } as React.CSSProperties}>
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
        headerActions={[<AddBookButton key="add-book" />]}
      >
        <BookFilters
          controller={controller}
          bookView={bookView}
          onBookViewChange={handleBookViewChange}
          advancedOpen={advancedVisible}
          onToggleAdvanced={() => {
            setShowAdvanced((v) => !v)
          }}
          onSaveAsShelf={
            effectiveFilter
              ? () => {
                  setSaveDialogOpen(true)
                }
              : undefined
          }
        />

        {advancedVisible && (
          <div className="border-border border-b px-4 pt-2 pb-4">
            <ShelfFilterEditor filter={userFilter} onChange={setUserFilter} />
          </div>
        )}

        {effectiveFilter && (
          <SaveAsShelfDialog
            open={saveDialogOpen}
            onOpenChange={setSaveDialogOpen}
            filter={effectiveFilter}
            sortField={sort.field}
            sortDirection={sort.direction}
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
              emptySubMessage={emptySubMessage}
              onClearFilters={clearAll}
              hasActiveFilters={activeFilterCount > 0}
              selectedBookUuid={selectedBookUuid}
              onBookClick={handleBookClick}
              onColumnClick={handleColumnClick}
              displayFields={displayFields}
              displayContext={displayContext}
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
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
              fetchNextPage={fetchNextPage}
              showMuted={showMuted}
              emptySubMessage={emptySubMessage}
              onClearFilters={clearAll}
              hasActiveFilters={activeFilterCount > 0}
              selectedBookUuid={selectedBookUuid}
              onBookClick={handleBookClick}
              displayFields={displayFields}
              displayContext={displayContext}
            />
          )}
          <SelectionToolbar allBookUuids={bookUuids} />
        </PageContent>
      </BookListLayout>
    </div>
  )
}
