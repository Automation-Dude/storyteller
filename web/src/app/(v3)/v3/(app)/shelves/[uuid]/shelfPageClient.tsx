"use client"

import { parseAsString, useQueryState } from "nuqs"
import { useMemo } from "react"

import { BookFilters, BookGrid } from "@v3/_/components/books"
import { BookListLayout } from "@v3/_/components/books/BookListLayout"
import { filterBooksClientSide } from "@v3/_/components/library/filter-books-client"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type BookWithRelations } from "@/database/books"
import { useListShelfBooksQuery, useListUserShelvesQuery } from "@/store/api"
import { extractEmojiIcon } from "@/strings"
import { type UUID } from "@/uuid"

export function ShelfPageClient({ shelfUuid }: { shelfUuid: UUID }) {
  const t = useTranslation("ShelfPage")
  const { isSelecting, toggleSelection } = useBookSelection()

  const [selectedBookUuid, setSelectedBookUuid] = useQueryState(
    "book",
    parseAsString,
  )

  const { data: books = [], isLoading } = useListShelfBooksQuery({ shelfUuid })
  const { data: shelves = [] } = useListUserShelvesQuery()

  const shelf = shelves.find((s) => s.uuid === shelfUuid)
  const shelfName = shelf
    ? extractEmojiIcon(shelf.name).label || shelf.name
    : "Shelf"

  const {
    state: filterState,
    onChange: onFilterChange,
    isSearching,
    deferredSearch,
    activeFilterCount,
    clearFilters,
    filterPopoverOpen,
    setFilterPopoverOpen,
  } = useBookFilters()

  const filteredBooks = useMemo(() => {
    if (books.length === 0) return []

    return filterBooksClientSide(books, {
      search: deferredSearch || undefined,
      sortField: filterState.sortField,
      sortDirection: filterState.sortDirection,
      mediaFilter: filterState.mediaFilter,
      statusFilter: filterState.statusFilter,
    })
  }, [books, deferredSearch, filterState])

  const bookUuids = useMemo(
    () => filteredBooks.map((b) => b.uuid),
    [filteredBooks],
  )

  const selectedBook = useMemo(
    () => filteredBooks.find((b) => b.uuid === selectedBookUuid),
    [filteredBooks, selectedBookUuid],
  )

  const showMuted = isSearching

  const handleBookClick = (book: BookWithRelations) => {
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
    <BookListLayout
      headerBreadcrumbs={[{ label: shelfName }]}
      selectedBookUuid={selectedBookUuid}
      selectedBook={selectedBook}
      onClosePanel={handleClosePanel}
      allBookUuids={bookUuids}
    >
      <BookFilters
        className="pt-1"
        state={filterState}
        onChange={onFilterChange}
        filterPopoverOpen={filterPopoverOpen}
        setFilterPopoverOpen={setFilterPopoverOpen}
      />

      <PageContent className="p-4">
        <BookGrid
          books={filteredBooks}
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
          onClearFilters={clearFilters}
          hasActiveFilters={activeFilterCount > 0}
          selectedBookUuid={selectedBookUuid}
          onBookClick={handleBookClick}
        />
      </PageContent>
    </BookListLayout>
  )
}
