"use client"

import { parseAsString, useQueryState } from "nuqs"
import { useMemo } from "react"

import { BookGrid } from "@v3/_/components/books"
import { BookListLayout } from "@v3/_/components/books/BookListLayout"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"

import { type BookWithRelations } from "@/database/books"
import { useListShelfBooksQuery, useListUserShelvesQuery } from "@/store/api"
import { extractEmojiIcon } from "@/strings"
import { type UUID } from "@/uuid"

// a shelf is a standalone book view -- unlike collections it does not list the
// other shelves in the sidebar.
export function ShelfPageClient({ shelfUuid }: { shelfUuid: UUID }) {
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

  const bookUuids = useMemo(() => books.map((b) => b.uuid), [books])

  const selectedBook = useMemo(
    () => books.find((b) => b.uuid === selectedBookUuid),
    [books, selectedBookUuid],
  )

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

  console.log("selectedBook", selectedBook)

  return (
    <BookListLayout
      headerBreadcrumbs={[{ label: shelfName }]}
      selectedBookUuid={selectedBookUuid}
      selectedBook={selectedBook}
      onClosePanel={handleClosePanel}
      allBookUuids={bookUuids}
    >
      <PageContent className="p-4">
        <BookGrid
          books={books}
          isLoading={isLoading}
          isFetchingNextPage={false}
          hasNextPage={false}
          fetchNextPage={() => {}}
          showMuted={false}
          emptyMessage="This shelf is empty"
          selectedBookUuid={selectedBookUuid}
          onBookClick={handleBookClick}
        />
      </PageContent>
    </BookListLayout>
  )
}
