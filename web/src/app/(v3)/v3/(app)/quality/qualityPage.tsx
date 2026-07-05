"use client"

import * as icon from "@/icons"
import { parseAsString, useQueryState } from "nuqs"
import { useCallback, useMemo } from "react"

import { BookFilters, BookGrid } from "@v3/_/components/books"
import { BookList } from "@/app/(v3)/v3/_/components/books/List/BookList"
import { BookListLayout } from "@v3/_/components/books/BookListLayout"
import { SelectionToolbar } from "@v3/_/components/books/SelectionToolbar"
import { GradePill } from "@v3/_/components/books/grade-pill"
import { Button } from "@v3/_/components/ui/button"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { useReportPanel } from "@v3/_/hooks/use-report-panel"
import { cn } from "@v3/_/lib/utils"

import { type ShelfFilterCondition, type ShelfFilterNode } from "@/shelves"
import {
  type DisplayField,
  type SortContext,
  type SortDirection,
  type SortField,
  deriveDisplayFields,
} from "@/sort"
import {
  useGetAlignmentFacetsQuery,
  useListInfiniteBooksInfiniteQuery,
} from "@/store/api"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import {
  type BookView,
  selectBookView,
  uiSettingsSlice,
} from "@/store/slices/uiSettingsSlice"

const GRADES = ["A+", "A", "A-", "B", "B-", "C", "D", "F"] as const

// the alignment signals shown as sortable columns in the list. click a header
// to sort by that column, just like the books page.
const ALIGNMENT_COLUMNS: DisplayField[] = [
  "alignmentGrade",
  "alignmentScore",
  "alignmentMissingSentences",
  "alignmentMutedChapters",
]

// the locked base filter: only books that carry a grade. layered under whatever
// the user picks with the facet chips / filter bar.
const GRADED_SEED: ShelfFilterNode = {
  type: "condition",
  field: "alignmentGrade",
  operator: "isNotEmpty",
}

export default function QualityPage() {
  const dispatch = useAppDispatch()
  const bookView = useAppSelector(selectBookView)

  const handleBookViewChange = useCallback(
    (view: BookView) => {
      dispatch(uiSettingsSlice.actions.setBookView(view))
    },
    [dispatch],
  )

  const [selectedBookUuid, setSelectedBookUuid] = useQueryState(
    "book",
    parseAsString,
  )
  const [, setReportMode] = useReportPanel()
  const { isSelecting, toggleSelection } = useBookSelection()

  const controller = useBookFilters({
    seed: GRADED_SEED,
    defaultSortField: "alignmentScore",
    defaultSortDirection: "desc",
  })
  const {
    queryArg,
    userFilter,
    sort,
    setSort,
    conditionsForField,
    setConditionsForField,
    removeField,
    displayOverrides,
    isSearching,
    activeFilterCount,
    clearAll,
  } = controller

  const { data: facets } = useGetAlignmentFacetsQuery()

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useListInfiniteBooksInfiniteQuery(queryArg)

  const books = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data?.pages],
  )
  const bookUuids = useMemo(() => books.map((b) => b.uuid), [books])
  const selectedBook = useMemo(
    () => books.find((b) => b.uuid === selectedBookUuid),
    [books, selectedBookUuid],
  )

  // the grade facet row and the muted toggle write ordinary conditions onto the
  // controller so they stay in sync with the filter bar's chips.
  const activeGrade =
    conditionsForField("alignmentGrade").find((c) => c.operator === "is")
      ?.value ?? null
  const setGrade = useCallback(
    (grade: string | null) => {
      if (!grade) {
        removeField("alignmentGrade")
        return
      }
      const cond: ShelfFilterCondition = {
        type: "condition",
        field: "alignmentGrade",
        operator: "is",
        value: grade,
      }
      setConditionsForField("alignmentGrade", [cond])
    },
    [removeField, setConditionsForField],
  )

  const mutedActive = conditionsForField("alignmentMutedChapters").some(
    (c) => c.operator === "greaterThan",
  )
  const toggleMuted = useCallback(() => {
    if (mutedActive) {
      removeField("alignmentMutedChapters")
      return
    }
    const cond: ShelfFilterCondition = {
      type: "condition",
      field: "alignmentMutedChapters",
      operator: "greaterThan",
      value: 0,
    }
    setConditionsForField("alignmentMutedChapters", [cond])
  }, [mutedActive, removeField, setConditionsForField])

  const displayContext: SortContext = useMemo(() => ({ seriesUuid: null }), [])
  const displayFields = deriveDisplayFields(
    sort.field,
    userFilter,
    displayContext,
    displayOverrides,
  )

  const showMuted =
    isSearching || (isFetching && !isFetchingNextPage && books.length > 0)

  const handleBookClick = (book: { uuid: string }) => {
    if (isSelecting) {
      toggleSelection(book.uuid)
      return
    }
    void setReportMode(true)
    void setSelectedBookUuid(book.uuid)
  }

  const handleClosePanel = () => {
    void setSelectedBookUuid(null)
    void setReportMode(false)
  }

  return (
    <div style={{ "--header-height": "4rem" } as React.CSSProperties}>
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
        onClosePanel={handleClosePanel}
      >
        <BookFilters
          controller={controller}
          seedLabel="Graded"
          bookView={bookView}
          onBookViewChange={handleBookViewChange}
        />

        {/* alignment-specific facet row: grade chips + muted toggle, counts
            from the server-side facets. */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2">
          <Button
            variant={activeGrade ? "ghost" : "secondary"}
            size="sm"
            onClick={() => {
              setGrade(null)
            }}
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
                onClick={() => {
                  setGrade(activeGrade === g ? null : g)
                }}
                className={cn(
                  "flex items-center gap-1 rounded transition",
                  activeGrade === g
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
          <Button
            variant={mutedActive ? "secondary" : "ghost"}
            size="sm"
            onClick={toggleMuted}
            className="ml-2 gap-1.5"
          >
            <icon.VolumeOff className="size-4" />
            Muted
            {facets && facets.muted > 0 && (
              <span className="text-muted-foreground tabular-nums">
                {facets.muted}
              </span>
            )}
          </Button>
        </div>

        {/* shrink only the list title here, without touching BookListItem. */}
        <PageContent className="p-4 [&_.font-heading]:text-[0.8125rem]!">
          {bookView === "list" ? (
            <BookList
              books={books}
              isLoading={isLoading}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
              fetchNextPage={fetchNextPage}
              showMuted={showMuted}
              emptyMessage="No graded books yet"
              emptySubMessage="Books get a grade after they finish aligning."
              onClearFilters={clearAll}
              hasActiveFilters={activeFilterCount > 0}
              selectedBookUuid={selectedBookUuid}
              onBookClick={handleBookClick}
              displayFields={displayFields}
              displayContext={displayContext}
              visibleColumns={ALIGNMENT_COLUMNS}
              sortField={sort.field}
              sortDirection={sort.direction}
              onSortChange={(field: SortField, dir: SortDirection) => {
                setSort(field, dir)
              }}
            />
          ) : (
            <BookGrid
              books={books}
              isLoading={isLoading}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
              fetchNextPage={fetchNextPage}
              showMuted={showMuted}
              emptyMessage="No graded books yet"
              emptySubMessage="Books get a grade after they finish aligning."
              onClearFilters={clearAll}
              hasActiveFilters={activeFilterCount > 0}
              selectedBookUuid={selectedBookUuid}
              onBookClick={handleBookClick}
              displayFields={displayFields}
              displayContext={displayContext}
            />
          )}
          <SelectionToolbar allBookUuids={bookUuids} />
        </PageContent>
      </BookListLayout>
    </div>
  )
}
