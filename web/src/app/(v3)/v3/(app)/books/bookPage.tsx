"use client"

import { parseAsBoolean, parseAsString, useQueryState } from "nuqs"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { AddBookButton } from "@v3/_/components/AddBookButton"
import { BookFilters, BookGrid } from "@v3/_/components/books"
import { BookListLayout } from "@v3/_/components/books/BookListLayout"
import { DisplayControl } from "@v3/_/components/books/DisplayControl"
import { DisplayOverflowContent } from "@v3/_/components/books/DisplayOverflowContent"
import { SaveAsShelfDialog } from "@v3/_/components/books/SaveAsShelfDialog"
import { SelectionToolbar } from "@v3/_/components/books/SelectionToolbar"
import { SortControl } from "@v3/_/components/books/SortControl"
import { SortOverflowContent } from "@v3/_/components/books/SortOverflowContent"
import { ShelfFilterEditor } from "@v3/_/components/shelves/ShelfFilterEditor"
import { OverflowToolbar } from "@v3/_/components/ui/overflow-toolbar"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { CompactHeaderSentinel } from "@v3/_/hooks/use-compact-header"
import { useReportPanel } from "@v3/_/hooks/use-report-panel"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { BookList } from "@/app/(v3)/v3/_/components/books/List/BookList"
import { type UserPermissionSet } from "@/database/users"
import {
  type DisplayField,
  GENERAL_SORT_FIELDS,
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
  const tLabel = useTranslation("Common.fields.label")
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
  // const [, setReportMode] = useReportPanel()
  const [, setReportMode] = useQueryState(
    "report",
    parseAsBoolean.withDefault(false),
  )

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

  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false)

  const handleColumnSort = useCallback(
    (field: SortField, direction: SortDirection) => {
      setSort(field, direction)
    },
    [setSort],
  )

  const sortFieldOptions = useMemo<{ value: SortField; label: string }[]>(
    () => GENERAL_SORT_FIELDS.map((value) => ({ value, label: tLabel(value) })),
    [tLabel],
  )

  // the books page has no single-series context; position is not offered.
  const displayContext: SortContext = useMemo(() => ({ seriesUuid: null }), [])
  const displayFields = useMemo(
    () =>
      deriveDisplayFields(
        sort.field,
        effectiveFilter,
        displayContext,
        displayOverrides,
      ),
    [sort.field, effectiveFilter, displayContext, displayOverrides],
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

  const selectedIndex = selectedBookUuid
    ? books.findIndex((b) => b.uuid === selectedBookUuid)
    : -1

  const NEXT_PREFETCH_MARGIN = 3
  useEffect(() => {
    if (selectedIndex < 0) return
    const remaining = books.length - 1 - selectedIndex
    if (
      remaining <= NEXT_PREFETCH_MARGIN &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage()
    }
  }, [
    selectedIndex,
    books.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ])

  const goToNext = useMemo(() => {
    const atEnd = selectedIndex >= books.length - 1
    if (selectedIndex < 0 || (atEnd && !hasNextPage)) return undefined
    return () => {
      const next = bookUuids[selectedIndex + 1]
      if (next) void setSelectedBookUuid(next)
    }
  }, [selectedIndex, books.length, bookUuids, hasNextPage, setSelectedBookUuid])

  const goToPrevious = useMemo(() => {
    if (selectedIndex <= 0) return undefined
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return () => void setSelectedBookUuid(bookUuids[selectedIndex - 1]!)
  }, [selectedIndex, bookUuids, setSelectedBookUuid])

  const showMuted =
    isSearching || (isFetching && !isFetchingNextPage && books.length > 0)

  const handleBookClick = useCallback(
    (book: { uuid: string }, isSelecting: boolean, isBookSelected: boolean) => {
      if (isSelecting || isBookSelected) {
        toggleSelection(book.uuid)
        return
      }
      void setReportMode(false)
      void setSelectedBookUuid(book.uuid)
    },
    [],
  )
  const handleBookClickRef = useRef(handleBookClick)
  const selectedBookUuidRef = useRef(selectedBookUuid)
  const setReportModeRef = useRef(setReportMode)
  if (handleBookClickRef.current !== handleBookClick) {
    console.log("handleBookClickRef updated")
    handleBookClickRef.current = handleBookClick
  }
  if (selectedBookUuidRef.current !== selectedBookUuid) {
    console.log("selectedBookUuidRef updated")
    selectedBookUuidRef.current = selectedBookUuid
  }
  if (setReportModeRef.current !== setReportMode) {
    console.log("setReportModeRef updated")
    setReportModeRef.current = setReportMode
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
      nextBook={goToNext}
      previousBook={goToPrevious}
      search={controller.search}
      onSearchChange={controller.setSearch}
      searchPlaceholder={t.plain("seachBooksPlaceholder")}
      headerActions={
        <OverflowToolbar>
          <OverflowToolbar.Item
            id="sort"
            label={t.plain("sortBy.tooltip")}
            priority={1}
            overflowContent={
              <SortOverflowContent
                options={sortFieldOptions}
                field={sort.field}
                direction={sort.direction}
                onChange={setSort}
              />
            }
          >
            <SortControl
              options={sortFieldOptions}
              field={sort.field}
              direction={sort.direction}
              onChange={setSort}
              onOpenChange={setSortMenuOpen}
              open={sortMenuOpen}
            />
          </OverflowToolbar.Item>

          <OverflowToolbar.Item
            id="display"
            label={t.plain("displayOptions.tooltip")}
            priority={2}
            overflowContent={
              <DisplayOverflowContent
                displayOverrides={displayOverrides}
                onDisplayOverridesChange={controller.setDisplayOverrides}
                bookView={bookView}
                onBookViewChange={handleBookViewChange}
              />
            }
          >
            <DisplayControl
              displayOverrides={displayOverrides}
              onDisplayOverridesChange={controller.setDisplayOverrides}
              open={displayMenuOpen}
              onOpenChange={setDisplayMenuOpen}
              bookView={bookView}
              onBookViewChange={handleBookViewChange}
            />
          </OverflowToolbar.Item>

          <OverflowToolbar.Item id="add-book" label="Add book">
            <AddBookButton />
          </OverflowToolbar.Item>
        </OverflowToolbar>
      }
    >
      <BookFilters
        controller={controller}
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

      <PageContent className="p-6">
        <CompactHeaderSentinel />
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
        <SelectionToolbar allBooks={books} />
      </PageContent>
    </BookListLayout>
  )
}
