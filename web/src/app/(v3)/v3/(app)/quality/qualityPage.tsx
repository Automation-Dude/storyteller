"use client"

import { IconVolumeOff } from "@tabler/icons-react"
import { parseAsBoolean, parseAsString, useQueryState } from "nuqs"
import { useMemo, useState } from "react"

import { BookList } from "@v3/_/components/books/BookList"
import { BookListLayout } from "@v3/_/components/books/BookListLayout"
import { SearchInput } from "@v3/_/components/books/SearchInput"
import { GradePill } from "@v3/_/components/books/grade-pill"
import { Button } from "@v3/_/components/ui/button"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { useDebounce } from "@v3/_/hooks/use-debounce"
import { useReportPanel } from "@v3/_/hooks/use-report-panel"
import { cn } from "@v3/_/lib/utils"

import { type ShelfFilter, type ShelfFilterNode } from "@/shelves"
import { type DisplayField, type SortDirection, type SortField } from "@/sort"
import {
  useGetAlignmentFacetsQuery,
  useListInfiniteBooksInfiniteQuery,
} from "@/store/api"

const GRADES = ["A+", "A", "A-", "B", "B-", "C", "D", "F"] as const

// list-only columns fixed to the alignment quality signals.
const COLUMNS: DisplayField[] = [
  "alignmentGrade",
  "alignmentScore",
  "alignmentMissingSentences",
  "alignmentMutedChapters",
]

export default function QualityPage() {
  const [selectedBookUuid, setSelectedBookUuid] = useQueryState(
    "book",
    parseAsString,
  )
  const [, setReportMode] = useReportPanel()
  const [grade, setGrade] = useQueryState("grade", parseAsString)
  const [muted, setMuted] = useQueryState(
    "muted",
    parseAsBoolean.withDefault(false),
  )
  const [search, setSearch] = useState("")
  const deferredSearch = useDebounce(search, 250)
  const [sort, setSort] = useQueryState(
    "sort",
    parseAsString.withDefault("alignmentScore"),
  )
  const [direction, setDirection] = useQueryState(
    "dir",
    parseAsString.withDefault("desc"),
  )

  const { data: facets } = useGetAlignmentFacetsQuery()

  // only graded books; optionally narrowed to one grade and/or muted chapters.
  const filter: ShelfFilter = useMemo(() => {
    const children: ShelfFilterNode[] = [
      grade
        ? {
            type: "condition",
            field: "alignmentGrade",
            operator: "is",
            value: grade,
          }
        : {
            type: "condition",
            field: "alignmentGrade",
            operator: "isNotEmpty",
          },
    ]
    if (muted) {
      children.push({
        type: "condition",
        field: "alignmentMutedChapters",
        operator: "greaterThan",
        value: 0,
      })
    }
    return { type: "and", children }
  }, [grade, muted])

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useListInfiniteBooksInfiniteQuery({
    orderBy: sort as SortField,
    orderDirection: direction as SortDirection,
    filter,
    search: deferredSearch || undefined,
  })

  const books = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data?.pages],
  )

  const selectedBook = useMemo(
    () => books.find((b) => b.uuid === selectedBookUuid),
    [books, selectedBookUuid],
  )

  return (
    <BookListLayout
      headerBreadcrumbs={[
        {
          render: (
            <h1 className="font-heading text-foreground truncate text-3xl font-normal">
              Alignment quality
            </h1>
          ),
        },
      ]}
      selectedBookUuid={selectedBookUuid}
      selectedBook={selectedBook}
      onClosePanel={() => {
        void setSelectedBookUuid(null)
        void setReportMode(false)
      }}
    >
      <div className="flex flex-col gap-2 px-4 pt-2">
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search graded books"
            className="max-w-xs"
          />
          <Button
            variant={muted ? "secondary" : "ghost"}
            size="sm"
            onClick={() => void setMuted(muted ? null : true)}
            className="gap-1.5"
          >
            <IconVolumeOff className="size-4" />
            Muted
            {facets && facets.muted > 0 && (
              <span className="text-muted-foreground tabular-nums">
                {facets.muted}
              </span>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={grade ? "ghost" : "secondary"}
            size="sm"
            onClick={() => void setGrade(null)}
            className="gap-1.5"
          >
            All
            {facets && (
              <span className="text-muted-foreground tabular-nums">
                {facets.total}
              </span>
            )}
          </Button>
          {GRADES.map((g) => {
            const count = facets?.grades[g] ?? 0
            return (
              <button
                key={g}
                type="button"
                disabled={!!facets && count === 0}
                onClick={() => void setGrade(grade === g ? null : g)}
                className={cn(
                  "flex items-center gap-1 rounded transition",
                  grade === g
                    ? "ring-primary ring-2"
                    : "opacity-70 hover:opacity-100",
                  !!facets && count === 0 && "opacity-30",
                )}
              >
                <GradePill grade={g} />
                <span className="text-muted-foreground pr-1 text-xs tabular-nums">
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* shrink only the list title here, without touching BookListItem. */}
      <PageContent className="p-4 [&_.font-heading]:!text-[0.8125rem]">
        <BookList
          books={books}
          isLoading={isLoading}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          fetchNextPage={fetchNextPage}
          showMuted={isFetching && !isFetchingNextPage && books.length > 0}
          emptyMessage="No graded books yet"
          emptySubMessage="Books get a grade after they finish aligning."
          selectedBookUuid={selectedBookUuid}
          onBookClick={(book) => {
            void setReportMode(true)
            void setSelectedBookUuid(book.uuid)
          }}
          displayFields={COLUMNS}
          visibleColumns={[]}
          sortField={sort as SortField}
          sortDirection={direction as SortDirection}
          onSortChange={(field, dir) => {
            void setSort(field)
            void setDirection(dir)
          }}
        />
      </PageContent>
    </BookListLayout>
  )
}
