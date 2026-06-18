"use client"

import { IconAdjustmentsHorizontal, IconBookmarkPlus } from "@tabler/icons-react"
import { parseAsString, useQueryState } from "nuqs"
import { useMemo, useState } from "react"

import { AddBookButton } from "@v3/_/components/AddBookButton"
import { BookFilters, BookGrid } from "@v3/_/components/books"
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
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type UserPermissionSet } from "@/database/users"
import { type ShelfFilterNode } from "@/shelves"
import { type SortContext, deriveDisplayField } from "@/sort"
import { useListInfiniteBooksInfiniteQuery } from "@/store/api"
import { type UUID } from "@/uuid"

export default function BookPage({
  permissions: _permissions,
}: {
  permissions: UserPermissionSet
}) {
  const t = useTranslation("BooksPage")

  const { isSelecting, toggleSelection } = useBookSelection()

  const [selectedBookUuid, setSelectedBookUuid] = useQueryState(
    "book",
    parseAsString,
  )

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
    void setSelectedBookUuid(book.uuid)
  }

  const handleClosePanel = () => {
    void setSelectedBookUuid(null)
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
        </PageContent>
      </BookListLayout>
    </div>
  )
}
