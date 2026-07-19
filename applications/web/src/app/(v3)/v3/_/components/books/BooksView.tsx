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
  // forces the list/table columns for this page, overriding the global
  // listDisplayFields preference (e.g. quality shows only alignment fields)
  listDisplayFieldsOverride?: DisplayField[]
  displayContext?: SortContext
  sortField?: SortField
  sortDirection?: SortDirection
  onSortChange?: (field: SortField, direction: SortDirection) => void
}

export function BooksView({
  displayFields,
  listDisplayFieldsOverride,
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
  const listDisplayFieldsPref = useAppSelector(selectListDisplayFields)
  const listDisplayFields = listDisplayFieldsOverride ?? listDisplayFieldsPref
  const listShowThumbnail = useAppSelector(selectListShowThumbnail)

  if (layout === "list") {
    // rows track the panel edge during the transform-mode open/close slide,
    // same as PageMain's chrome rule (the var is 0px at rest)
    return (
      <div className="max-w-[calc(100%-var(--panel-reveal,0px))]">
        {listView === "table" ? (
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
        ) : (
          <BookList
            {...shared}
            onBookClick={onBookClick}
            displayFields={listDisplayFields}
            showThumbnail={listShowThumbnail}
          />
        )}
      </div>
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
