"use client"

import {
  IconArrowLeft,
  IconArrowUpRight,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconX,
} from "@tabler/icons-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { parseAsString, useQueryState } from "nuqs"
import { useCallback, useMemo, useState } from "react"

import { useListBooksQuery } from "@/store/api"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import { uiSettingsSlice } from "@/store/slices/uiSettingsSlice"
import { type UUID } from "@/uuid"

import { BookFilters, BookGrid } from "@v3/_/components/books"
import { filterBooksClientSide } from "@v3/_/components/library/filter-books-client"
import {
  type LibraryItem,
  type LibrarySectionDef,
} from "@v3/_/components/library/library-sections"
import { SiteHeader } from "@v3/_/components/site-header"
import { Button } from "@v3/_/components/ui/button"
import { Input } from "@v3/_/components/ui/input"
import {
  PageContent,
  PageHeader,
  PageLayout,
  PageMain,
  PagePanel,
  PageSidebar,
} from "@v3/_/components/ui/page-layout"
import { ScrollArea } from "@v3/_/components/ui/scroll-area"
import { Skeleton } from "@v3/_/components/ui/skeleton"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { cn } from "@v3/_/lib/utils"
import { SearchInput } from "../books/SearchInput"

const noop = () => {}

const DynamicBookDetailsContent = dynamic(
  () =>
    import("@v3/_/components/books/BookDetailsPage").then(
      (mod) => mod.BookDetailsContent,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="p-6">
        <Skeleton className="h-60 w-full rounded-lg" />
      </div>
    ),
  },
)

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
  const isMobile = useIsMobile()
  const dispatch = useAppDispatch()

  const sidebarWidth = useAppSelector(
    (state) => state.uiSettings.librarySidebarWidth,
  )

  const panelWidth = useAppSelector(
    (state) => state.uiSettings.detailPanelWidth,
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

  const handleSidebarWidthChange = useCallback(
    (width: number) => {
      dispatch(uiSettingsSlice.actions.setLibrarySidebarWidth(width))
    },
    [dispatch],
  )

  const handlePanelWidthChange = useCallback(
    (width: number) => {
      dispatch(uiSettingsSlice.actions.setDetailPanelWidth(width))
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
        state={filterState}
        onChange={onFilterChange}
        filterPopoverOpen={filterPopoverOpen}
        setFilterPopoverOpen={setFilterPopoverOpen}
        hideCollectionFilter
        hideSeriesFilter
      />

      <PageContent className="p-4">
        {selectedItem ? (
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
        ) : (
          <div className="text-muted-foreground flex h-[50vh] flex-col items-center justify-center gap-2">
            <IconSearch className="h-12 w-12 opacity-40" />
            <p className="text-lg font-medium">
              Select an item to see its books
            </p>
          </div>
        )}
      </PageContent>
    </>
  )

  if (isMobile) {
    if (selectedItem && selectedItemName) {
      return (
        <MobileBookView
          title={title}
          selectedItemName={selectedItemName}
          onBack={handleBackToList}
        >
          {booksContent}
        </MobileBookView>
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
    <PageLayout>
      <PageSidebar
        width={sidebarWidth}
        onWidthChange={handleSidebarWidthChange}
        className="border-r"
      >
        {sidebarContent}
      </PageSidebar>

      <PageMain>
        <PageHeader>
          <SiteHeader
            breadcrumbs={[
              { label: title, url: "" },
              ...(selectedItemName ? [{ label: selectedItemName }] : []),
            ]}
          />
        </PageHeader>
        {booksContent}
      </PageMain>

      <PagePanel
        open={!!selectedBookUuid}
        width={panelWidth}
        onWidthChange={handlePanelWidthChange}
        className="border-l"
      >
        {selectedBookUuid && (
          <>
            <div className="flex items-center justify-between border-b px-4 py-2">
              <Button
                variant="ghost"
                size="sm"
                render={
                  <Link href={`/v3/books/${selectedBookUuid}`}>
                    <IconArrowUpRight className="mr-1 h-4 w-4" />
                    Open Full Page
                  </Link>
                }
              />
              <Button variant="ghost" size="icon-sm" onClick={handleClosePanel}>
                <IconX className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="h-full flex-1">
              <DynamicBookDetailsContent
                uuid={selectedBookUuid as UUID}
                compact
              />
            </ScrollArea>
          </>
        )}
      </PagePanel>
    </PageLayout>
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
          // className="h-8"
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
    return (
      <div className="flex flex-col gap-1 px-2 py-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="bg-muted/40 h-9 animate-pulse rounded-md" />
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
              "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              isSelected
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "hover:bg-sidebar-accent/50",
            )}
          >
            <span className="min-w-0 truncate">{item.name}</span>

            <span
              className={cn(
                "text-muted-foreground flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs tabular-nums",
                isSelected && "bg-sidebar-accent-foreground/10",
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
