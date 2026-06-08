"use client"

import {
  IconBook,
  IconHeadphones,
  IconLoader,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"

import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import { Checkbox } from "@v3/_/components/ui/checkbox"
import { Skeleton } from "@v3/_/components/ui/skeleton"
import { V3Link } from "@v3/_/components/v3-link"
import { useOptionalBookSelection } from "@v3/_/hooks/use-book-selection"
import { cn } from "@v3/_/lib/utils"

import { type BookWithRelations } from "@/database/books"
import { getCoverUrl } from "@/store/api"

type BookListProps = {
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
}

function BookListItem({
  book,
  muted = false,
}: {
  book: BookWithRelations
  muted?: boolean
}) {
  const [coverError, setCoverError] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  const selection = useOptionalBookSelection()
  const isSelecting = selection?.isSelecting ?? false
  const isSelected = selection?.isSelected(book.uuid) ?? false
  const toggleSelection = selection?.toggleSelection
  const startSelecting = selection?.startSelecting

  const hasAudiobook = book.audiobook !== null
  const hasEbook = book.ebook !== null
  const isSynced =
    book.readaloud !== null && book.readaloud.status === "ALIGNED"

  const authors = book.authors
  const primarySeries = book.series.find((s) => s.featured) ?? book.series[0]

  const coverUrl = getCoverUrl(book.uuid, {
    width: 80,
    height: 80,
    audio: hasAudiobook && !hasEbook,
    updatedAt:
      book.ebook?.updatedAt ?? book.audiobook?.updatedAt ?? book.updatedAt,
  })

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!isSelecting) {
        startSelecting?.()
      }
      toggleSelection?.(book.uuid)
    },
    [toggleSelection, book.uuid, isSelecting, startSelecting],
  )

  const showCheckbox = isSelecting || isHovering

  const content = (
    <div className="flex items-center gap-3 py-2">
      <div className="relative h-12 w-12 flex-shrink-0">
        {selection && showCheckbox && (
          <div
            className={cn(
              "absolute -top-1 -left-1 z-20 transition-opacity",
              !isSelecting &&
                !isSelected &&
                "opacity-0 group-hover:opacity-100",
            )}
            onClick={handleCheckboxClick}
          >
            <Checkbox
              checked={isSelected}
              className="bg-background/80 h-4 w-4 border-2 shadow-sm backdrop-blur"
            />
          </div>
        )}
        <div className="bg-muted h-full w-full overflow-hidden rounded">
          {!coverError ? (
            <Image
              height={80}
              width={80}
              src={coverUrl}
              alt={book.title}
              loading="lazy"
              onError={() => {
                setCoverError(true)
              }}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <IconBook className="text-muted-foreground/50 h-5 w-5" />
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="group-hover:text-primary truncate font-medium">
            {book.title}
          </span>
          {primarySeries && (
            <span className="text-muted-foreground flex-shrink-0 text-xs">
              {primarySeries.name}
              {primarySeries.position && ` #${primarySeries.position}`}
            </span>
          )}
        </div>
        <div className="text-muted-foreground truncate text-sm">
          {authors.map((a) => a.name).join(", ")}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {isSynced && (
          <Badge variant="secondary" className="gap-1">
            <IconRefresh className="h-3 w-3" />
            Synced
          </Badge>
        )}
        {hasAudiobook && !isSynced && (
          <Badge variant="outline" className="gap-1">
            <IconHeadphones className="h-3 w-3" />
          </Badge>
        )}
        {book.status && (
          <Badge variant="outline" className="text-muted-foreground">
            {book.status.name}
          </Badge>
        )}
      </div>
    </div>
  )

  if (isSelecting) {
    return (
      <div
        className={cn(
          "group hover:bg-accent cursor-pointer rounded-lg px-3 transition-colors",
          muted && "opacity-50",
          isSelected && "bg-accent",
        )}
        onClick={() => toggleSelection?.(book.uuid)}
        onMouseEnter={() => {
          setIsHovering(true)
        }}
        onMouseLeave={() => {
          setIsHovering(false)
        }}
      >
        {content}
      </div>
    )
  }

  return (
    <V3Link
      href={`/books/${book.uuid}`}
      className={cn(
        "group hover:bg-accent block rounded-lg px-3 transition-colors",
        muted && "opacity-50",
      )}
      onMouseEnter={() => {
        setIsHovering(true)
      }}
      onMouseLeave={() => {
        setIsHovering(false)
      }}
    >
      {content}
    </V3Link>
  )
}

function BookListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <Skeleton className="h-12 w-12 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}

export function BookList({
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
}: BookListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null)

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
      <div className="divide-y">
        {Array.from({ length: 10 }).map((_, i) => (
          <BookListItemSkeleton key={i} />
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
          "divide-y transition-opacity duration-200",
          showMuted && "opacity-60",
        )}
      >
        {books.map((book) => (
          <BookListItem key={book.uuid} book={book} muted={showMuted} />
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
