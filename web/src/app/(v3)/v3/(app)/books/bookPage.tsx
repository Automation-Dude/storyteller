"use client"

import { parseAsString, useQueryState } from "nuqs"
import { useMemo } from "react"

import { AddBookButton } from "@v3/_/components/AddBookButton"
import { BookFilters, BookGrid } from "@v3/_/components/books"
import { BookListLayout } from "@v3/_/components/books/BookListLayout"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type UserPermissionSet } from "@/database/users"
import { useListInfiniteBooksInfiniteQuery } from "@/store/api"

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
    </div>
  )
}
