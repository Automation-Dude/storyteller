"use client"

import { parseAsString, useQueryState } from "nuqs"
import { useCallback, useMemo, useRef } from "react"

import { BookFilters } from "@v3/_/components/books"
import { BookListLayout } from "@v3/_/components/books/BookListLayout"
import { BooksView } from "@v3/_/components/books/BooksView"
import { SelectionToolbar } from "@v3/_/components/books/SelectionToolbar"
import { SiteHeader } from "@v3/_/components/site-header"
import { PageContent, PageHeader } from "@v3/_/components/ui/page-layout"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import {
  BookSelectionProvider,
  useBookSelection,
} from "@v3/_/hooks/use-book-selection"
import { useReportPanel } from "@v3/_/hooks/use-report-panel"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { cn } from "@/cn"
import { type BookWithRelations } from "@/database/books"
import {
  type DisplayField,
  GENERAL_SORT_FIELDS,
  type SortContext,
  type SortDirection,
  type SortField,
  deriveDisplayFields,
} from "@/sort"
import { useListShelfBooksQuery, useListUserShelvesQuery } from "@/store/api"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import {
  selectGridDisplayFields,
  selectLibrarySidebarWidth,
  uiSettingsSlice,
} from "@/store/slices/uiSettingsSlice"
import { extractEmojiIcon } from "@/strings"
import { useBookInSidePanel } from "../../_/hooks/use-open-book"

function ShelvesPageInner() {
  const t = useTranslation("ShelvesPage")
  const tLabel = useTranslation("Common.fields.label")
  const dispatch = useAppDispatch()
  const { isSelecting, toggleSelection } = useBookSelection()

  const sidebarWidth = useAppSelector(selectLibrarySidebarWidth)
  const gridDisplayFields = useAppSelector(selectGridDisplayFields)

  const handleDisplayFieldsChange = useCallback(
    (fields: DisplayField[] | null) => {
      dispatch(uiSettingsSlice.actions.setGridDisplayFields(fields))
    },
    [dispatch],
  )

  const sortFieldOptions = useMemo<{ value: SortField; label: string }[]>(
    () => GENERAL_SORT_FIELDS.map((value) => ({ value, label: tLabel(value) })),
    [tLabel],
  )

  const [selectedItem, setSelectedItem] = useQueryState("item", parseAsString)
  const { selectedBookUuid, setSelectedBookUuid } = useBookInSidePanel()
  const [, setReportMode] = useReportPanel()

  const { data: shelves = [] } = useListUserShelvesQuery()

  const activeShelfUuid =
    selectedItem && selectedItem !== "_none" ? selectedItem : null

  const activeShelf = activeShelfUuid
    ? shelves.find((s) => s.uuid === activeShelfUuid)
    : null

  const controller = useBookFilters()
  const {
    effectiveFilter,
    sort,
    setSort,
    isSearching,
    deferredSearch,
    activeFilterCount,
    clearAll,
  } = controller

  const { data: books = [], isLoading } = useListShelfBooksQuery(
    {
      shelfUuid: activeShelfUuid ?? "",
      sortField: sort.field,
      orderDirection: sort.direction,
      ...(deferredSearch ? { search: deferredSearch } : {}),
      ...(effectiveFilter ? { filter: effectiveFilter } : {}),
    },
    { skip: !activeShelfUuid },
  )

  const handleColumnSort = useCallback(
    (field: SortField, direction: SortDirection) => {
      setSort(field, direction)
    },
    [setSort],
  )

  const displayContext: SortContext = useMemo(() => ({ seriesUuid: null }), [])
  const displayFields = useMemo(
    () =>
      deriveDisplayFields(
        sort.field,
        effectiveFilter,
        displayContext,
        gridDisplayFields,
        controller.isDefaultSort,
      ),
    [
      sort.field,
      effectiveFilter,
      displayContext,
      gridDisplayFields,
      controller.isDefaultSort,
    ],
  )

  const selectedBook = useMemo(
    () => books.find((b) => b.uuid === selectedBookUuid),
    [books, selectedBookUuid],
  )

  const showMuted = isSearching

  const handleBookClick = (book: BookWithRelations) => {
    if (isSelecting) {
      toggleSelection(book.uuid)
      return
    }

    void setReportMode(false)
    void setSelectedBookUuid(book.uuid)
  }

  const handleColumnClick = (book: BookWithRelations) => {
    void setReportMode(true)
    void setSelectedBookUuid(book.uuid)
  }

  const handleClosePanel = () => {
    void setSelectedBookUuid(null)
    void setReportMode(false)
  }

  const sidebarRef = useRef<HTMLDivElement>(null)

  const sidebar = (
    <div
      ref={sidebarRef}
      className="flex h-full flex-col overflow-y-auto border-r"
    >
      <div className="flex flex-col gap-0.5 p-2">
        {shelves.map((shelf) => {
          const { label } = extractEmojiIcon(shelf.name)
          const isActive = shelf.uuid === activeShelfUuid

          return (
            <button
              key={shelf.uuid}
              type="button"
              onClick={() => {
                void setSelectedItem(shelf.uuid)
              }}
              className={cn(
                "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <span className="truncate">{label || shelf.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <BookListLayout
      headerBreadcrumbs={[
        { label: t("title") },
        ...(activeShelf
          ? [
              {
                label:
                  extractEmojiIcon(activeShelf.name).label || activeShelf.name,
              },
            ]
          : []),
      ]}
      sidebar={sidebar}
      sidebarWidth={sidebarWidth}
      onSidebarWidthChange={(w) => {
        dispatch(uiSettingsSlice.actions.setLibrarySidebarWidth(w))
      }}
      selectedBookUuid={selectedBookUuid}
      selectedBook={selectedBook}
      onClosePanel={handleClosePanel}
    >
      {activeShelfUuid ? (
        <>
          <BookFilters
            className="pt-1"
            controller={controller}
            sortOptions={sortFieldOptions}
            onSortChange={setSort}
            displayOverrides={gridDisplayFields}
            onDisplayOverridesChange={handleDisplayFieldsChange}
            currentFields={displayFields}
          />

          <PageContent className="p-6">
            <BooksView
              books={books}
              isLoading={isLoading}
              isFetchingNextPage={false}
              hasNextPage={false}
              fetchNextPage={() => {}}
              showMuted={showMuted}
              emptyMessage={t.plain("emptyShelf")}
              emptySubMessage={
                deferredSearch || activeFilterCount > 0
                  ? t.plain("adjustFilters")
                  : undefined
              }
              onClearFilters={clearAll}
              hasActiveFilters={activeFilterCount > 0}
              selectedBookUuid={selectedBookUuid}
              onBookClick={handleBookClick}
              onColumnClick={handleColumnClick}
              displayFields={displayFields}
              displayContext={displayContext}
              sortField={sort.field}
              sortDirection={sort.direction}
              onSortChange={handleColumnSort}
            />

            <SelectionToolbar allBooks={books} />
          </PageContent>
        </>
      ) : (
        <PageContent className="flex flex-1 items-center justify-center p-6">
          <p className="text-muted-foreground text-sm">{t("selectAShelf")}</p>
        </PageContent>
      )}
    </BookListLayout>
  )
}

export function ShelvesPageClient() {
  return (
    <BookSelectionProvider>
      <ShelvesPageInner />
    </BookSelectionProvider>
  )
}
