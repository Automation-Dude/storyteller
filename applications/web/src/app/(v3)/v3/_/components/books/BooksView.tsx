"use client"

import { BookGrid } from "@/app/(v3)/v3/_/components/books/Grid/BookGrid"
import { BookList } from "@/app/(v3)/v3/_/components/books/List/BookList"
import { BookTable } from "@/app/(v3)/v3/_/components/books/List/BookTable"
import { type BookWithRelations } from "@/database/books"
import {
  type DisplayField,
  type SortContext,
  type SortDirection,
  type SortField,
} from "@/sort"
import { useAppSelector } from "@/store/appState"
import {
  selectBookLayout,
  selectGridView,
  selectListDisplayFields,
  selectListShowThumbnail,
  selectListView,
} from "@/store/slices/uiSettingsSlice"

type BooksViewProps = {
  books: BookWithRelations[]
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  fetchNextPage: () => void
  showMuted: boolean
  emptyMessage?: string
  emptySubMessage?: string | undefined
  onClearFilters?: () => void
  hasActiveFilters?: boolean
  selectedBookUuid?: string | null
  // grid cards pass the selection flags; list/table rows pass just the book
  onBookClick?: (
    book: BookWithRelations,
    isSelecting?: boolean,
    isBookSelected?: boolean,
  ) => void
  // click on a specific column cell (table view only, e.g. alignment grade)
  onColumnClick?: (book: BookWithRelations, field: DisplayField) => void
  // the grid layout's resolved display fields (auto or manual)
  displayFields?: DisplayField[]
  displayContext?: SortContext
  sortField?: SortField
  sortDirection?: SortDirection
  onSortChange?: (field: SortField, direction: SortDirection) => void
}

// the one place a page's books render: switches on the device layout (grid /
// list) and its per-layout view (cards / thumbnails, rows / table), fed from
// uiSettings so every book list behaves identically.
export function BooksView({
  displayFields,
  onBookClick,
  onColumnClick,
  sortField,
  sortDirection,
  onSortChange,
  ...shared
}: BooksViewProps) {
  const layout = useAppSelector(selectBookLayout)
  const gridView = useAppSelector(selectGridView)
  const listView = useAppSelector(selectListView)
  const listDisplayFields = useAppSelector(selectListDisplayFields)
  const listShowThumbnail = useAppSelector(selectListShowThumbnail)

  if (layout === "list") {
    if (listView === "table") {
      return (
        <BookTable
          {...shared}
          onBookClick={onBookClick}
          onColumnClick={onColumnClick}
          columns={listDisplayFields}
          showThumbnail={listShowThumbnail}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
        />
      )
    }

    return (
      <BookList
        {...shared}
        onBookClick={onBookClick}
        displayFields={listDisplayFields}
        showThumbnail={listShowThumbnail}
      />
    )
  }

  return (
    <BookGrid
      {...shared}
      onBookClick={onBookClick}
      // the thumbnail view is the card view with no meta below the cover; the
      // user's field selection is kept for switching back
      displayFields={gridView === "thumbnail" ? [] : displayFields}
    />
  )
}
