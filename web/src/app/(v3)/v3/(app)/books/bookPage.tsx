"use client"

import { IconPencil, IconPencilMinus } from "@tabler/icons-react"
import { useMemo } from "react"

import { useListInfiniteBooksInfiniteQuery } from "@/store/api"

import { BookFilters, BookGrid } from "@v3/_/components/books"
import { SelectionToolbar } from "@v3/_/components/books/SelectionToolbar"
import { type HeaderAction } from "@v3/_/components/header-actions"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"

export default function BookPage() {
  const { isSelecting, startSelecting, stopSelecting } = useBookSelection()

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
    handleSortChange,
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
    limit: 2,
  })

  const books = data?.pages.flatMap((page) => page) ?? []
  const bookUuids = useMemo(() => books.map((b) => b.uuid), [books])
  const showMuted =
    isSearching || (isFetching && !isFetchingNextPage && books.length > 0)

  const canEdit = true

  const actions: HeaderAction[] = useMemo(() => {
    if (!canEdit) return []
    return [
      {
        label: isSelecting ? "Done" : "Select",
        icon: isSelecting ? (
          <IconPencilMinus className="h-4 w-4" />
        ) : (
          <IconPencil className="h-4 w-4" />
        ),
        onClick: isSelecting ? stopSelecting : startSelecting,
      },
    ]
  }, [canEdit, isSelecting, startSelecting, stopSelecting])

  return (
    <>
      <div className="flex flex-1 flex-col">
        <BookFilters
          state={state}
          onChange={onChange}
          filterPopoverOpen={filterPopoverOpen}
          setFilterPopoverOpen={setFilterPopoverOpen}
          showSaveSearch
        />
        <div className="flex-1 p-4">
          <BookGrid
            books={books}
            isLoading={isLoading}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage ?? false}
            fetchNextPage={fetchNextPage}
            showMuted={showMuted}
            emptySubMessage={
              deferredSearch || activeFilterCount > 0
                ? "Try adjusting your search or filters"
                : undefined
            }
            onClearFilters={clearFilters}
            hasActiveFilters={activeFilterCount > 0}
            sortField={state.sortField}
            sortDirection={state.sortDirection}
            onSortChange={handleSortChange}
          />
        </div>
      </div>
      <SelectionToolbar allBookUuids={bookUuids} />
    </>
  )
}
