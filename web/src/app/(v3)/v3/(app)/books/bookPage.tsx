"use client"

import { parseAsString, useQueryState } from "nuqs"
import { useCallback, useMemo } from "react"

import { type UserPermissionSet } from "@/database/users"
import { useListInfiniteBooksInfiniteQuery } from "@/store/api"

import { BookFilters, BookGrid } from "@v3/_/components/books"
import { BookListLayout } from "@v3/_/components/books/BookListLayout"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"

export default function BookPage({
  permissions: _permissions,
}: {
  permissions: UserPermissionSet
}) {
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
  } = useBookFilters()

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useListInfiniteBooksInfiniteQuery({
    ...queryArg,
  })

  const books = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data?.pages],
  )

  const bookUuids = useMemo(() => books.map((b) => b.uuid), [books])

  const showMuted =
    isSearching || (isFetching && !isFetchingNextPage && books.length > 0)

  const handleBookClick = useCallback(
    (book: { uuid: string }) => {
      if (isSelecting) {
        toggleSelection(book.uuid)
        return
      }

      void setSelectedBookUuid(book.uuid)
    },
    [setSelectedBookUuid, isSelecting, toggleSelection],
  )

  const handleClosePanel = useCallback(() => {
    void setSelectedBookUuid(null)
  }, [setSelectedBookUuid])

  return (
    <BookListLayout
      headerBreadcrumbs={[{ label: "Books" }]}
      selectedBookUuid={selectedBookUuid}
      onClosePanel={handleClosePanel}
      allBookUuids={bookUuids}
    >
      <BookFilters
        state={state}
        onChange={onChange}
        filterPopoverOpen={filterPopoverOpen}
        setFilterPopoverOpen={setFilterPopoverOpen}
        showSaveSearch
      />

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
        />
      </PageContent>
    </BookListLayout>
  )
}
