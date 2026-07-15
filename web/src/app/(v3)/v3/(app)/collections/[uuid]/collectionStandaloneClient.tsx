"use client"

import { parseAsString, useQueryState } from "nuqs"
import { useCallback, useMemo } from "react"

import { BookFilters } from "@v3/_/components/books"
import { BookListLayout } from "@v3/_/components/books/BookListLayout"
import { BooksView } from "@v3/_/components/books/BooksView"
import { SelectionToolbar } from "@v3/_/components/books/SelectionToolbar"
import { Button } from "@v3/_/components/ui/button"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { V3Link } from "@v3/_/components/v3-link"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { useReportPanel } from "@v3/_/hooks/use-report-panel"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type BookWithRelations } from "@/database/books"
import * as icon from "@/icons"
import {
  type DisplayField,
  GENERAL_SORT_FIELDS,
  type SortContext,
  type SortDirection,
  type SortField,
  deriveDisplayFields,
} from "@/sort"
import {
  useListBooksQuery,
  useListCollectionsQuery,
  useListInfiniteBooksInfiniteQuery,
} from "@/store/api"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import {
  selectGridDisplayFields,
  uiSettingsSlice,
} from "@/store/slices/uiSettingsSlice"
import { extractEmojiIcon } from "@/strings"
import { type UUID } from "@/uuid"

export function CollectionStandalonePage({
  collectionUuid,
}: {
  collectionUuid: UUID
}) {
  const t = useTranslation("CollectionPage")
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

  const { data: collections = [] } = useListCollectionsQuery()
  const collection = collections.find((c) => c.uuid === collectionUuid)

  const collectionName = collection
    ? extractEmojiIcon(collection.name).label || collection.name
    : "Collection"

  const controller = useBookFilters({ collectionContext: collectionUuid })
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

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useListInfiniteBooksInfiniteQuery({
      ...queryArg,
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

  const books = data?.pages.flatMap((page) => page) ?? []

  const selectedBook = books.find((b) => b.uuid === selectedBookUuid)

  const showMuted = isSearching

  const handleBookClick = (book: BookWithRelations) => {
    if (isSelecting) {
      toggleSelection(book.uuid)
      return
    }

    void setReportMode(false)
    void setSelectedBookUuid(book.uuid)
  }

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
      headerBreadcrumbs={[
        { label: t("breadcrumb"), url: "/collections" },
        { label: collectionName },
      ]}
      headerActions={
        <Button
          variant="ghost"
          size="sm"
          render={
            <V3Link href={`/collections?item=${collectionUuid}`}>
              <icon.ArrowRight className="mr-1 size-3.5" />
              {t("goToAllCollections")}
            </V3Link>
          }
        />
      }
      selectedBookUuid={selectedBookUuid}
      selectedBook={selectedBook}
      onClosePanel={handleClosePanel}
    >
      {collection?.description && (
        <p className="text-muted-foreground max-w-md px-4 text-sm">
          {collection.description}
        </p>
      )}
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
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          fetchNextPage={fetchNextPage}
          showMuted={showMuted}
          emptyMessage={t.plain("emptyCollection")}
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
