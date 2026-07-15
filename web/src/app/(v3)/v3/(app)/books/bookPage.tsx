"use client"

import { parseAsBoolean, parseAsString, useQueryState } from "nuqs"
import { useCallback, useEffect, useMemo } from "react"

import { AddBookButton } from "@v3/_/components/AddBookButton"
import { BookFilters } from "@v3/_/components/books"
import { BookListLayout } from "@v3/_/components/books/BookListLayout"
import { BooksView } from "@v3/_/components/books/BooksView"
import { SelectionToolbar } from "@v3/_/components/books/SelectionToolbar"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { useTranslation } from "@v3/_/hooks/use-translation"

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
  selectGridDisplayFields,
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

  const gridDisplayFields = useAppSelector(selectGridDisplayFields)

  const handleDisplayFieldsChange = useCallback(
    (fields: DisplayField[] | null) => {
      dispatch(uiSettingsSlice.actions.setGridDisplayFields(fields))
    },
    [dispatch],
  )

  const { toggleSelection } = useBookSelection()

  const [selectedBookUuid, setSelectedBookUuid] = useQueryState(
    "book",
    parseAsString,
  )
  const [, setReportMode] = useQueryState(
    "report",
    parseAsBoolean.withDefault(false),
  )

  const controller = useBookFilters()
  const {
    queryArg,
    effectiveFilter,
    sort,
    setSort,
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

  const sortFieldOptions = useMemo<{ value: SortField; label: string }[]>(
    () => GENERAL_SORT_FIELDS.map((value) => ({ value, label: tLabel(value) })),
    [tLabel],
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

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useListInfiniteBooksInfiniteQuery({ ...queryArg, limit: 1000 })

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
    (
      book: { uuid: string },
      isSelecting?: boolean,
      isBookSelected?: boolean,
    ) => {
      if (isSelecting || isBookSelected) {
        toggleSelection(book.uuid)
        return
      }
      void setReportMode(false)
      void setSelectedBookUuid(book.uuid)
    },
    [],
  )

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
            <h1 className="font-heading text-foreground truncate text-2xl font-normal">
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
      headerActions={<AddBookButton />}
    >
      <BookFilters
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
          sortField={sort.field}
          sortDirection={sort.direction}
          onSortChange={handleColumnSort}
        />
        <SelectionToolbar allBooks={books} />
      </PageContent>
    </BookListLayout>
  )
}
