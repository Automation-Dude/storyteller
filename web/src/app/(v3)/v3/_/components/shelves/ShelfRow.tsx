"use client"

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { useMemo, useRef } from "react"

import { BookCard } from "@v3/_/components/books/BookCard"
import { BookCardSkeleton } from "@v3/_/components/books/BookCardSkeleton"
import { Button } from "@v3/_/components/ui/button"
import { V3Link } from "@v3/_/components/v3-link"
import { cn } from "@v3/_/lib/utils"

import { type BookWithRelations } from "@/database/books"
import { type HomeShelfWithDetails } from "@/database/shelves"
import {
  useListBooksQuery,
  useListShelfBooksQuery,
  useListStatusesQuery,
} from "@/store/api"

type ShelfRowProps = {
  shelf: HomeShelfWithDetails
  className?: string | undefined
}

export function ShelfRow({ shelf, className }: ShelfRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const { books, isLoading, seeAllHref } = useShelfBooks(shelf)

  const scrollLeft = () => {
    if (!scrollContainerRef.current) return
    scrollContainerRef.current.scrollBy({ left: -400, behavior: "smooth" })
  }

  const scrollRight = () => {
    if (!scrollContainerRef.current) return
    scrollContainerRef.current.scrollBy({ left: 400, behavior: "smooth" })
  }

  const displayName = shelf.name ?? getDefaultName(shelf.shelfType)

  if (isLoading) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center justify-between px-4">
          <h2 className="font-heading text-lg font-semibold">{displayName}</h2>
        </div>

        <div className="flex gap-4 overflow-hidden px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[150px] shrink-0">
              <BookCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (books.length === 0) {
    return null
  }

  return (
    <div className={cn("group/shelf flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between px-4">
        <div className="flex items-baseline gap-3">
          <h2 className="font-heading text-lg font-medium">{displayName}</h2>

          <V3Link
            href={seeAllHref}
            className="text-muted-foreground hover:text-foreground text-sm opacity-0 transition-colors transition-opacity group-hover/shelf:opacity-100"
          >
            See all
          </V3Link>
        </div>

        <div className="flex gap-1 opacity-0 transition-opacity group-hover/shelf:opacity-100">
          <Button variant="ghost" size="icon-sm" onClick={scrollLeft}>
            <IconChevronLeft className="size-4" />
          </Button>

          <Button variant="ghost" size="icon-sm" onClick={scrollRight}>
            <IconChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="scroll-x flex snap-x scroll-pl-4 gap-4 px-4 pb-2"
      >
        {books.map((book) => (
          <div
            key={book.uuid}
            className="w-[150px] shrink-0 snap-mandatory snap-start"
          >
            <BookCard book={book} />
          </div>
        ))}
      </div>
    </div>
  )
}

function getDefaultName(shelfType: string): string {
  switch (shelfType) {
    case "currentlyReading":
      return "Currently Reading"
    case "nextUpInSeries":
      return "Next Up in Series"
    case "recentlyAdded":
      return "Recently Added"
    default:
      return "Shelf"
  }
}

type UseShelfBooksResult = {
  books: BookWithRelations[]
  isLoading: boolean
  seeAllHref: string
}

function useShelfBooks(shelf: HomeShelfWithDetails): UseShelfBooksResult {
  const isCustomShelf = shelf.shelfType === "custom" && shelf.shelfUuid !== null

  const { data: shelfBooks = [], isLoading: isLoadingShelfBooks } =
    useListShelfBooksQuery(
      {
        shelfUuid: shelf.shelfUuid!,
        limit: 20,
        orderBy: "createdAt",
        orderDirection: "desc",
      },
      { skip: !isCustomShelf },
    )

  const { data: allBooks = [], isLoading: isLoadingAllBooks } =
    useListBooksQuery(undefined, {
      skip:
        shelf.shelfType !== "currentlyReading" &&
        shelf.shelfType !== "nextUpInSeries" &&
        shelf.shelfType !== "recentlyAdded",
    })

  const { data: statuses } = useListStatusesQuery(undefined, {
    skip: shelf.shelfType !== "currentlyReading",
  })

  const readingStatus = statuses?.find((s) => s.name === "Reading")

  const currentlyReadingBooks = useMemo(() => {
    if (shelf.shelfType !== "currentlyReading") return []

    return allBooks
      .filter((book) => book.status?.name === "Reading")
      .sort(
        (a, b) => (b.position?.timestamp ?? 0) - (a.position?.timestamp ?? 0),
      )
  }, [allBooks, shelf.shelfType])

  const nextUpBooks = useMemo(() => {
    if (shelf.shelfType !== "nextUpInSeries") return []
    return computeNextUpInSeries(allBooks)
  }, [allBooks, shelf.shelfType])

  const recentlyAddedBooks = useMemo(() => {
    if (shelf.shelfType !== "recentlyAdded") return []

    return allBooks
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf(),
      )
      .slice(0, 20)
  }, [allBooks, shelf.shelfType])

  if (isCustomShelf) {
    return {
      books: shelfBooks,
      isLoading: isLoadingShelfBooks,
      seeAllHref: "/books",
    }
  }

  if (shelf.shelfType === "recentlyAdded") {
    return {
      books: recentlyAddedBooks,
      isLoading: isLoadingAllBooks,
      seeAllHref: "/books",
    }
  }

  if (shelf.shelfType === "currentlyReading") {
    return {
      books: currentlyReadingBooks,
      isLoading: isLoadingAllBooks,
      seeAllHref: readingStatus
        ? `/statuses?status=${readingStatus.uuid}`
        : "/books",
    }
  }

  if (shelf.shelfType === "nextUpInSeries") {
    return {
      books: nextUpBooks,
      isLoading: isLoadingAllBooks,
      seeAllHref: "/series",
    }
  }

  return {
    books: [],
    isLoading: false,
    seeAllHref: "/books",
  }
}

function computeNextUpInSeries(
  books: BookWithRelations[],
): BookWithRelations[] {
  type UUID = string
  const latestReadInSeries = new Map<UUID, BookWithRelations>()
  const resultSet = new Set<UUID>()

  for (const book of books) {
    if (!book.series.length) continue

    for (const s of book.series) {
      const latestRead = latestReadInSeries.get(s.uuid)

      if (!latestRead) {
        if (book.status?.name === "Read") {
          latestReadInSeries.set(s.uuid, book)
        }
        continue
      }

      const latestSeriesPos =
        latestRead.series.find((ls) => ls.uuid === s.uuid)?.position ?? 0

      if ((latestSeriesPos ?? 0) < (s.position ?? 0)) {
        if (book.status?.name === "Read") {
          latestReadInSeries.set(s.uuid, book)
        } else if (!resultSet.has(book.uuid)) {
          resultSet.add(book.uuid)
        }
      }
    }
  }

  return books
    .filter((book) => resultSet.has(book.uuid))
    .sort((a, b) => {
      const latestA = a.series
        .map((s) => latestReadInSeries.get(s.uuid))
        .filter((book): book is BookWithRelations => !!book)[0]

      const latestB = b.series
        .map((s) => latestReadInSeries.get(s.uuid))
        .filter((book): book is BookWithRelations => !!book)[0]

      if (!latestA || !latestB) return 0

      return (
        (latestB.position?.timestamp ?? 0) - (latestA.position?.timestamp ?? 0)
      )
    })
}
