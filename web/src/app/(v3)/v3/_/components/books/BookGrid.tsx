import { IconLoader, IconSearch } from "@tabler/icons-react"
import { useCallback, useEffect, useRef } from "react"

import { type BookWithRelations } from "@/database/books"

import { BookCard } from "@v3/_/components/books/BookCard"
import { BookCardSkeleton } from "@v3/_/components/books/BookCardSkeleton"
import { Button } from "@v3/_/components/ui/button"
import { useOptionalBookSelection } from "@v3/_/hooks/use-book-selection"
import { cn } from "@v3/_/lib/utils"

type BookGridProps = {
  books: BookWithRelations[]
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  fetchNextPage: () => void
  showMuted: boolean
  emptyMessage?: string | undefined
  emptySubMessage?: string | undefined
  onClearFilters?: () => void
  hasActiveFilters?: boolean
  selectedBookUuid?: string | null
  onBookClick?: (book: BookWithRelations) => void
}

export function BookGrid({
  books,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  showMuted,
  emptyMessage = "No books found",
  emptySubMessage,
  onClearFilters,
  hasActiveFilters,
  selectedBookUuid,
  onBookClick,
}: BookGridProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const selection = useOptionalBookSelection()
  const isSelecting = (selection?.selectedBooks.size ?? 0) > 0

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries
      if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  )

  useEffect(() => {
    const element = loadMoreRef.current
    if (!element) return

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "200px",
      threshold: 0,
    })

    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [handleObserver])

  if (isLoading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <BookCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[50vh] flex-col items-center justify-center gap-2">
        <IconSearch className="h-12 w-12 opacity-40" />
        <p className="text-lg font-medium">{emptyMessage}</p>
        {emptySubMessage && <p className="text-sm">{emptySubMessage}</p>}

        {hasActiveFilters && onClearFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="mt-2"
          >
            Clear Filters
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          "grid max-w-screen grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 transition-opacity duration-200",
          showMuted && "opacity-60",
        )}
      >
        {books.map((book) => (
          <BookCard
            key={book.uuid}
            book={book}
            muted={showMuted}
            selected={book.uuid === selectedBookUuid}
            isSelecting={isSelecting}
            isBookSelected={selection?.isSelected(book.uuid) ?? false}
            {...(selection
              ? {
                  onToggleSelection: selection.toggleSelection,
                }
              : {})}
            {...(onBookClick ? { onClick: onBookClick } : {})}
          />
        ))}
      </div>

      <div ref={loadMoreRef} className="mt-8 flex justify-center">
        {isFetchingNextPage && (
          <div className="text-muted-foreground flex items-center gap-2">
            <IconLoader className="h-5 w-5 animate-spin" />
            <span>Loading more...</span>
          </div>
        )}
      </div>
    </>
  )
}
