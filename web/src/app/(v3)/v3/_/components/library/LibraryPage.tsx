"use client"

import {
  IconArrowLeft,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
} from "@tabler/icons-react"
import { parseAsString, useQueryState } from "nuqs"
import { useCallback, useEffect, useMemo, useState } from "react"

import { BookFilters, BookGrid } from "@v3/_/components/books"
import {
  BookDetailDrawer,
  BookListLayout,
} from "@v3/_/components/books/BookListLayout"
import { SearchInput } from "@v3/_/components/books/SearchInput"
import { filterBooksClientSide } from "@v3/_/components/library/filter-books-client"
import {
  type LibraryItem,
  type LibrarySectionDef,
} from "@v3/_/components/library/library-sections"
import { SiteHeader } from "@v3/_/components/site-header"
import { Button } from "@v3/_/components/ui/button"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { ScrollArea } from "@v3/_/components/ui/scroll-area"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { BookSelectionProvider } from "@v3/_/hooks/use-book-selection"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { useListBooksQuery } from "@/store/api"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import { uiSettingsSlice } from "@/store/slices/uiSettingsSlice"

const noop = () => {}

type SidebarSortMode = "name" | "count"

type LibraryPageProps = {
  title: string
  section: LibrarySectionDef
  defaultSidebarSort?: SidebarSortMode
}

export function LibraryPage({
  title,
  section,
  defaultSidebarSort = "name",
}: LibraryPageProps) {
  const t = useTranslation("LibraryPage")
  const isMobile = useIsMobile()
  const dispatch = useAppDispatch()

  const sidebarWidth = useAppSelector(
    (state) => state.uiSettings.librarySidebarWidth,
  )

  const { data: books, isLoading: booksLoading } = useListBooksQuery()

  const [selectedItem, setSelectedItem] = useQueryState("item", parseAsString)
  const [selectedBookUuid, setSelectedBookUuid] = useQueryState(
    "book",
    parseAsString,
  )

  const [sidebarSearch, setSidebarSearch] = useState("")
  const [sidebarSort, setSidebarSort] =
    useState<SidebarSortMode>(defaultSidebarSort)

  const {
    state: filterState,
    onChange: onFilterChange,
    isSearching,
    deferredSearch,
    activeFilterCount,
    clearFilters,
    filterPopoverOpen,
    setFilterPopoverOpen,
  } = useBookFilters()

  const allItems = useMemo(() => {
    if (!books) return []
    return section.extractItems(books)
  }, [books, section])

  const visibleItems = useMemo(() => {
    let items = allItems

    if (sidebarSearch) {
      const term = sidebarSearch.toLowerCase()
      items = items.filter((item) => item.name.toLowerCase().includes(term))
    }

    if (sidebarSort === "name") {
      items = [...items].sort((a, b) => a.name.localeCompare(b.name))
    } else {
      items = [...items].sort(
        (a, b) => b.bookCount - a.bookCount || a.name.localeCompare(b.name),
      )
    }

    return items
  }, [allItems, sidebarSearch, sidebarSort])

  useEffect(() => {
    const firstItem = visibleItems[0]

    if (!selectedItem && firstItem) {
      void setSelectedItem(firstItem.key)
    }
  }, [selectedItem, visibleItems, setSelectedItem])

  const sectionBooks = useMemo(() => {
    if (!books || !selectedItem) return []
    return section.filterBooks(books, selectedItem)
  }, [books, selectedItem, section])

  const filteredBooks = useMemo(() => {
    if (sectionBooks.length === 0) return []

    return filterBooksClientSide(sectionBooks, {
      search: deferredSearch || undefined,
      sortField: filterState.sortField,
      sortDirection: filterState.sortDirection,
      mediaFilter: filterState.mediaFilter,
      statusFilter: filterState.statusFilter,
    })
  }, [sectionBooks, deferredSearch, filterState])

  const selectedItemName = allItems.find((i) => i.key === selectedItem)?.name

  const selectedBook = useMemo(
    () => books?.find((b) => b.uuid === selectedBookUuid),
    [books, selectedBookUuid],
  )

  const handleSidebarWidthChange = useCallback(
    (width: number) => {
      dispatch(uiSettingsSlice.actions.setLibrarySidebarWidth(width))
    },
    [dispatch],
  )

  const handleItemClick = useCallback(
    (key: string) => {
      const next = key === selectedItem ? null : key
      void setSelectedItem(next)
      void setSelectedBookUuid(null)
    },
    [selectedItem, setSelectedItem, setSelectedBookUuid],
  )

  const handleBookClick = useCallback(
    (book: { uuid: string }) => {
      void setSelectedBookUuid(book.uuid)
    },
    [setSelectedBookUuid],
  )

  const handleClosePanel = useCallback(() => {
    void setSelectedBookUuid(null)
  }, [setSelectedBookUuid])

  const handleBackToList = useCallback(() => {
    void setSelectedItem(null)
    void setSelectedBookUuid(null)
  }, [setSelectedItem, setSelectedBookUuid])

  const showMuted = isSearching

  const sidebarContent = (
    <SidebarPanel
      title={title}
      items={visibleItems}
      selectedKey={selectedItem}
      isLoading={booksLoading}
      search={sidebarSearch}
      onSearchChange={setSidebarSearch}
      sortMode={sidebarSort}
      onSortModeChange={setSidebarSort}
      onItemClick={handleItemClick}
    />
  )

  const booksContent = (
    <>
      <BookFilters
        className="pt-1"
        state={filterState}
        onChange={onFilterChange}
        filterPopoverOpen={filterPopoverOpen}
        setFilterPopoverOpen={setFilterPopoverOpen}
        hideCollectionFilter
        hideSeriesFilter
      />

      <PageContent className="p-4">
        {selectedItem ? (
          <BookSelectionProvider key={selectedItem}>
            <BookGrid
              books={filteredBooks}
              isLoading={booksLoading}
              isFetchingNextPage={false}
              hasNextPage={false}
              fetchNextPage={noop}
              showMuted={showMuted}
              emptySubMessage={
                deferredSearch || activeFilterCount > 0
                  ? "Try adjusting your search or filters"
                  : undefined
              }
              onClearFilters={clearFilters}
              hasActiveFilters={activeFilterCount > 0}
              selectedBookUuid={selectedBookUuid}
              onBookClick={handleBookClick}
            />
          </BookSelectionProvider>
        ) : (
          <div className="text-muted-foreground flex h-[50vh] flex-col items-center justify-center gap-2">
            <IconSearch className="h-12 w-12 opacity-40" />
            <p className="text-lg font-medium">{t("emptyState")}</p>
          </div>
        )}
      </PageContent>
    </>
  )

  if (isMobile) {
    if (selectedItem && selectedItemName) {
      return (
        <>
          <MobileBookView
            title={title}
            selectedItemName={selectedItemName}
            onBack={handleBackToList}
          >
            {booksContent}
          </MobileBookView>

          <BookDetailDrawer
            selectedBookUuid={selectedBookUuid}
            selectedBook={selectedBook}
            onClose={handleClosePanel}
          />
        </>
      )
    }

    return (
      <div className="flex h-screen flex-col">
        <div className="relative h-(--header-height) w-full shrink-0">
          <SiteHeader breadcrumbs={[{ label: title }]} />
        </div>
        <div className="flex-1">{sidebarContent}</div>
      </div>
    )
  }

  return (
    <BookListLayout
      sidebar={sidebarContent}
      sidebarWidth={sidebarWidth}
      onSidebarWidthChange={handleSidebarWidthChange}
      headerBreadcrumbs={[
        { label: title, url: "" },
        ...(selectedItemName ? [{ label: selectedItemName }] : []),
      ]}
      selectedBookUuid={selectedBookUuid}
      selectedBook={selectedBook}
      onClosePanel={handleClosePanel}
    >
      {booksContent}
    </BookListLayout>
  )
}

function MobileBookView({
  title,
  selectedItemName,
  onBack,
  children,
}: {
  title: string
  selectedItemName: string
  onBack: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen flex-col">
      <div className="relative h-(--header-height) w-full shrink-0">
        <SiteHeader
          breadcrumbs={[{ label: title }, { label: selectedItemName }]}
          actions={
            <Button variant="ghost" size="sm" onClick={onBack}>
              <IconArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          }
        />
      </div>
      {children}
    </div>
  )
}

function SidebarPanel({
  title,
  items,
  selectedKey,
  isLoading,
  search,
  onSearchChange,
  sortMode,
  onSortModeChange,
  onItemClick,
}: {
  title: string
  items: LibraryItem[]
  selectedKey: string | null
  isLoading: boolean
  search: string
  onSearchChange: (value: string) => void
  sortMode: SidebarSortMode
  onSortModeChange: (mode: SidebarSortMode) => void
  onItemClick: (key: string) => void
}) {
  const toggleSort = useCallback(() => {
    onSortModeChange(sortMode === "name" ? "count" : "name")
  }, [sortMode, onSortModeChange])

  return (
    <ScrollArea className="relative flex h-full flex-col">
      <div className="bg-background sticky top-0 z-10 flex shrink-0 flex-col gap-4 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base">{title}</h2>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSort}
            title={sortMode === "name" ? "Sort by count" : "Sort by name"}
          >
            {sortMode === "name" ? (
              <IconSortAscending className="h-4 w-4" />
            ) : (
              <IconSortDescending className="h-4 w-4" />
            )}
          </Button>
        </div>

        <SearchInput
          placeholder="Search..."
          value={search}
          onChange={onSearchChange}
        />
      </div>

      <SidebarItemList
        items={items}
        selectedKey={selectedKey}
        onItemClick={onItemClick}
        isLoading={isLoading}
      />
    </ScrollArea>
  )
}

function SidebarItemList({
  items,
  selectedKey,
  onItemClick,
  isLoading,
}: {
  items: LibraryItem[]
  selectedKey: string | null
  onItemClick: (key: string) => void
  isLoading: boolean
}) {
  if (isLoading) {
    const widths = [60, 45, 72, 50, 38, 65, 55, 42, 68, 48, 58, 44]

    return (
      <div className="flex flex-col gap-0.5 px-2 py-1">
        {widths.map((w, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-md px-2 py-1.5"
          >
            <div
              className="bg-muted/60 h-4 animate-pulse rounded"
              style={{ width: `${w}%` }}
            />
            <div className="bg-muted/40 h-4 w-6 animate-pulse rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground px-4 py-8 text-center text-sm">
        No items found
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 px-2 py-1">
      {items.map((item) => {
        const isSelected = item.key === selectedKey

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              onItemClick(item.key)
            }}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left font-serif text-sm transition-colors",
              isSelected
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "hover:bg-sidebar-accent/50",
            )}
          >
            <span className="min-w-0 truncate">{item.name}</span>

            <span
              className={cn(
                "text-muted-foreground flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs tabular-nums",
                isSelected && "bg-sidebar-accent-foreground text-foreground",
              )}
            >
              {item.bookCount}
            </span>
          </button>
        )
      })}
    </div>
  )
}
