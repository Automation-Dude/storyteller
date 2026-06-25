"use client"

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { useMemo, useRef } from "react"

import { BookCard } from "@v3/_/components/books/BookCard"
import { BookCardSkeleton } from "@v3/_/components/books/BookCardSkeleton"
import { Button } from "@v3/_/components/ui/button"
import { V3Link } from "@v3/_/components/v3-link"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { type BookWithRelations } from "@/database/books"
import { type HomeSectionWithDetails } from "@/database/shelves"
import { type DisplayField } from "@/sort"
import {
  useListBooksQuery,
  useListShelfBooksQuery,
  useListStatusesQuery,
} from "@/store/api"

type ShelfRowProps = {
  shelf: HomeSectionWithDetails
  className?: string | undefined
}

export function ShelfRow({ shelf, className }: ShelfRowProps) {
  const t = useTranslation("HomePage")
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const { books, isLoading, seeAllHref, displayField } = useShelfBooks(shelf)

  const scrollLeft = () => {
    if (!scrollContainerRef.current) return
    scrollContainerRef.current.scrollBy({ left: -400, behavior: "smooth" })
  }

  const scrollRight = () => {
    if (!scrollContainerRef.current) return
    scrollContainerRef.current.scrollBy({ left: 400, behavior: "smooth" })
  }

  const displayName = shelf.name ?? t(`kinds.${shelf.kind}.name`)

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
            {t("shelf.seeAll")}
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
            <BookCard book={book} displayField={displayField} />
          </div>
        ))}
      </div>
    </div>
  )
}

type UseShelfBooksResult = {
  books: BookWithRelations[]
  isLoading: boolean
  seeAllHref: string
  displayField?: DisplayField
}

function useShelfBooks(shelf: HomeSectionWithDetails): UseShelfBooksResult {
  const isCustomShelf = shelf.kind === "custom" && shelf.shelfUuid !== null

  const { data: shelfBooks = [], isLoading: isLoadingShelfBooks } =
    useListShelfBooksQuery(
      {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
        shelf.kind !== "currentlyReading" &&
        shelf.kind !== "nextUpInSeries" &&
        shelf.kind !== "recentlyAdded",
    })

  const { data: statuses } = useListStatusesQuery(undefined, {
    skip: shelf.kind !== "currentlyReading",
  })

  const readingStatus = statuses?.find((s) => s.name === "Reading")

  const currentlyReadingBooks = useMemo(() => {
    if (shelf.kind !== "currentlyReading") return []

    return allBooks
      .filter((book) => book.status?.name === "Reading")
      .sort(
        (a, b) => (b.position?.timestamp ?? 0) - (a.position?.timestamp ?? 0),
      )
  }, [allBooks, shelf.kind])

  const nextUpBooks = useMemo(() => {
    if (shelf.kind !== "nextUpInSeries") return []
    return computeNextUpInSeries(allBooks)
  }, [allBooks, shelf.kind])

  const recentlyAddedBooks = useMemo(() => {
    if (shelf.kind !== "recentlyAdded") return []

    return allBooks
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf(),
      )
      .slice(0, 20)
  }, [allBooks, shelf.kind])

  if (isCustomShelf) {
    return {
      books: shelfBooks,
      isLoading: isLoadingShelfBooks,
      seeAllHref: `/shelves/${shelf.shelfUuid}`,
    }
  }

  if (shelf.kind === "recentlyAdded") {
    return {
      books: recentlyAddedBooks,
      isLoading: isLoadingAllBooks,
      seeAllHref: "/books?sort=createdAt,desc",
      displayField: "createdAt",
    }
  }

  if (shelf.kind === "currentlyReading") {
    return {
      books: currentlyReadingBooks,
      isLoading: isLoadingAllBooks,
      seeAllHref: readingStatus
        ? `/statuses?item=${readingStatus.uuid}`
        : "/books",
    }
  }

  if (shelf.kind === "nextUpInSeries") {
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

      if (latestSeriesPos < (s.position ?? 0)) {
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
