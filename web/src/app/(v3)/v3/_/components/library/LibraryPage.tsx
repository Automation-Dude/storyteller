"use client"

import {
  IconArrowLeft,
  IconBookmarkPlus,
  IconDotsVertical,
  IconEdit,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconTrash,
} from "@tabler/icons-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { parseAsString, useQueryState } from "nuqs"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { BookFilters, BookGrid } from "@v3/_/components/books"
import {
  BookDetailDrawer,
  BookListLayout,
} from "@v3/_/components/books/BookListLayout"
import { SearchInput } from "@v3/_/components/books/SearchInput"
import { EditCreatorDialog } from "@v3/_/components/library/EditCreatorDialog"
import { EditTagDialog } from "@v3/_/components/library/EditTagDialog"
import { SidebarEntityActions } from "@v3/_/components/library/SidebarEntityActions"
import { filterBooksClientSide } from "@v3/_/components/library/filter-books-client"
import {
  type LibraryEntityType,
  type LibraryItem,
  type LibrarySectionDef,
} from "@v3/_/components/library/library-sections"
import { SiteHeader } from "@v3/_/components/site-header"
import { Button } from "@v3/_/components/ui/button"
import { Checkbox } from "@v3/_/components/ui/checkbox"
import {
  ConfirmDialog,
  useConfirmAction,
} from "@v3/_/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { ScrollArea } from "@v3/_/components/ui/scroll-area"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import { BookSelectionProvider } from "@v3/_/hooks/use-book-selection"
import { useItemSelection } from "@v3/_/hooks/use-item-selection"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { usePinShelf } from "@v3/_/hooks/use-pin-shelf"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { type ShelfFilterNode } from "@/shelves"
import {
  useDeleteCollectionMutation,
  useDeleteCreatorMutation,
  useDeleteSeriesMutation,
  useDeleteTagMutation,
  useListBooksQuery,
} from "@/store/api"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import { uiSettingsSlice } from "@/store/slices/uiSettingsSlice"
import { type UUID } from "@/uuid"

const noop = () => {}
const SIDEBAR_ROW_HEIGHT = 30

function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null

  while (el) {
    const overflowY = getComputedStyle(el).overflowY
    if (overflowY === "auto" || overflowY === "scroll") return el
    el = el.parentElement
  }

  return null
}

function useDeleteEntity(entityType?: LibraryEntityType) {
  const [deleteTag] = useDeleteTagMutation()
  const [deleteCreator] = useDeleteCreatorMutation()
  const [deleteSeries] = useDeleteSeriesMutation()
  const [deleteCollection] = useDeleteCollectionMutation()

  return useCallback(
    async (uuid: UUID) => {
      switch (entityType) {
        case "tag":
          return deleteTag({ uuid }).unwrap()
        case "creator":
          return deleteCreator({ uuid }).unwrap()
        case "series":
          return deleteSeries({ uuid }).unwrap()
        case "collection":
          return deleteCollection({ uuid }).unwrap()
      }
    },
    [entityType, deleteTag, deleteCreator, deleteSeries, deleteCollection],
  )
}

type SidebarSortMode = "name" | "count"

type LibraryPageProps = {
  title: string
  section: LibrarySectionDef
  defaultSidebarSort?: SidebarSortMode
  // preselect a facet on first load (e.g. a specific collection from its route)
  // when there's no `item` query param yet.
  initialSelectedItem?: string
}

export function LibraryPage({
  title,
  section,
  defaultSidebarSort = "name",
  initialSelectedItem,
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
    if (selectedItem) return

    // prefer an explicit initial item (its facet must exist in the list),
    // otherwise fall back to the first visible item.
    const initial =
      initialSelectedItem && allItems.some((i) => i.key === initialSelectedItem)
        ? initialSelectedItem
        : visibleItems[0]?.key

    if (initial) void setSelectedItem(initial)
  }, [
    selectedItem,
    visibleItems,
    allItems,
    initialSelectedItem,
    setSelectedItem,
  ])

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

  // ref-stabilized so the callback identity never changes, preventing
  // the entire sidebar list from re-rendering when selectedItem changes
  const itemClickDepsRef = useRef({
    selectedItem,
    selectedBookUuid,
    books,
    section,
    deferredSearch,
    filterState,
  })
  itemClickDepsRef.current = {
    selectedItem,
    selectedBookUuid,
    books,
    section,
    deferredSearch,
    filterState,
  }

  const handleItemClick = useCallback(
    (key: string) => {
      const {
        selectedItem: current,
        selectedBookUuid: bookUuid,
        books: allBooks,
        section: sec,
        deferredSearch: search,
        filterState: filters,
      } = itemClickDepsRef.current

      const next = key === current ? null : key
      void setSelectedItem(next)

      if (next && bookUuid && allBooks) {
        const nextBooks = filterBooksClientSide(
          sec.filterBooks(allBooks, next),
          {
            search: search || undefined,
            sortField: filters.sortField,
            sortDirection: filters.sortDirection,
            mediaFilter: filters.mediaFilter,
            statusFilter: filters.statusFilter,
          },
        )
        void setSelectedBookUuid(nextBooks[0]?.uuid ?? null)
        return
      }

      void setSelectedBookUuid(null)
    },
    [setSelectedItem, setSelectedBookUuid],
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

  const tEntity = useTranslation("EntityActions")
  const { pinShelf, isPinning } = usePinShelf()
  const canPin = !!section.toShelfFilter
  const entityType = section.entityType

  const itemSelection = useItemSelection()

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<LibraryItem | null>(null)

  const handleEditItem = useCallback((item: LibraryItem) => {
    setEditItem(item)
    setEditDialogOpen(true)
  }, [])

  const pinDepsRef = useRef({ section, pinShelf })
  pinDepsRef.current = { section, pinShelf }

  const handlePinFacet = useCallback((item: LibraryItem) => {
    const { section: sec, pinShelf: pin } = pinDepsRef.current

    if (!sec.toShelfFilter) return
    void pin(item.name, sec.toShelfFilter(item.key))
  }, [])

  const headerDeleteEntity = useDeleteEntity(entityType)

  const handleHeaderDelete = useCallback(async () => {
    if (!selectedItem) return
    await headerDeleteEntity(selectedItem as UUID)
    void setSelectedItem(null)
  }, [selectedItem, headerDeleteEntity, setSelectedItem])

  const headerDeleteAction = useConfirmAction({
    onConfirm: handleHeaderDelete,
    title: tEntity.plain("deleteTitle", {
      count: 1,
      entity: entityType
        ? tEntity.plain(`entityTypes.${entityType}` as "entityTypes.tag", {
            count: 1,
          })
        : "",
    }),
    description: tEntity.plain("deleteDescription"),
    confirmLabel: tEntity.plain("delete"),
    variant: "destructive",
  })

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
      entityType={entityType}
      itemSelection={itemSelection}
      onEditItem={entityType ? handleEditItem : undefined}
      toShelfFilter={section.toShelfFilter}
      {...(canPin && { onPinItem: handlePinFacet })}
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

  const editDialog = entityType ? (
    <EntityEditDialog
      entityType={entityType}
      open={editDialogOpen}
      onOpenChange={setEditDialogOpen}
      item={editItem}
    />
  ) : null

  return (
    <>
      <BookListLayout
        sidebar={sidebarContent}
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={handleSidebarWidthChange}
        headerBreadcrumbs={[
          { label: title, url: "" },
          ...(selectedItemName ? [{ label: selectedItemName }] : []),
        ]}
        headerActions={
          selectedItem && selectedItemName ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm">
                    <IconDotsVertical className="h-4 w-4" />
                  </Button>
                }
              />

              <DropdownMenuContent align="end" className="min-w-40">
                {entityType && (
                  <DropdownMenuItem
                    onClick={() => {
                      handleEditItem({
                        key: selectedItem,
                        name: selectedItemName,
                        bookCount: 0,
                      })
                    }}
                  >
                    <IconEdit className="mr-2 h-4 w-4" />
                    {tEntity.plain("edit")}
                  </DropdownMenuItem>
                )}

                {canPin && (
                  <DropdownMenuItem
                    disabled={isPinning}
                    onClick={() => {
                      handlePinFacet({
                        key: selectedItem,
                        name: selectedItemName,
                        bookCount: 0,
                      })
                    }}
                  >
                    <IconBookmarkPlus className="mr-2 h-4 w-4" />
                    {t.plain("pinAsShelf")}
                  </DropdownMenuItem>
                )}

                {entityType && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(event) => {
                        headerDeleteAction.confirm(event)
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <IconTrash className="mr-2 h-4 w-4" />
                      {tEntity.plain("delete")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
        selectedBookUuid={selectedBookUuid}
        selectedBook={selectedBook}
        onClosePanel={handleClosePanel}
      >
        {booksContent}
      </BookListLayout>

      {editDialog}
      <ConfirmDialog {...headerDeleteAction.dialogProps} />
    </>
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

function EntityEditDialog({
  entityType,
  open,
  onOpenChange,
  item,
}: {
  entityType: LibraryEntityType
  open: boolean
  onOpenChange: (open: boolean) => void
  item: LibraryItem | null
}) {
  if (entityType === "tag") {
    return (
      <EditTagDialog
        open={open}
        onOpenChange={onOpenChange}
        tag={item ? { uuid: item.key, name: item.name } : null}
      />
    )
  }

  if (entityType === "creator") {
    return (
      <EditCreatorDialog
        open={open}
        onOpenChange={onOpenChange}
        creator={
          item ? { uuid: item.key, name: item.name, fileAs: null } : null
        }
      />
    )
  }

  // series and collections already have edit dialogs elsewhere;
  // for now the sidebar edit uses the tag/creator ones.
  // a full implementation could import EditSeriesDialog / EditCollectionDialog here.
  return null
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
  onPinItem,
  entityType,
  itemSelection,
  onEditItem,
  toShelfFilter,
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
  onPinItem?: (item: LibraryItem) => void
  entityType?: LibraryEntityType
  itemSelection?: ReturnType<typeof useItemSelection>
  onEditItem?: (item: LibraryItem) => void
  toShelfFilter?: (itemKey: string) => ShelfFilterNode
}) {
  const t = useTranslation("LibraryPage")
  const tEntity = useTranslation("EntityActions")

  const toggleSort = useCallback(() => {
    onSortModeChange(sortMode === "name" ? "count" : "name")
  }, [sortMode, onSortModeChange])

  const isSelecting = itemSelection?.isSelecting ?? false

  const [menuOpen, setMenuOpen] = useState(false)
  const [menuTarget, setMenuTarget] = useState<LibraryItem | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const handleOpenItemMenu = useCallback(
    (item: LibraryItem, anchor: HTMLElement) => {
      setMenuTarget(item)
      setMenuAnchor(anchor)
      setMenuOpen(true)
    },
    [],
  )

  const deleteEntity = useDeleteEntity(entityType)

  const handleRowDelete = useCallback(async () => {
    if (!menuTarget) return
    await deleteEntity(menuTarget.key as UUID)
    setMenuOpen(false)
  }, [menuTarget, deleteEntity])

  const rowDeleteAction = useConfirmAction({
    onConfirm: handleRowDelete,
    title: menuTarget
      ? tEntity.plain("deleteTitle", {
          count: 1,
          entity: entityType
            ? tEntity.plain(`entityTypes.${entityType}` as "entityTypes.tag", {
                count: 1,
              })
            : "",
        })
      : "",
    description: tEntity.plain("deleteDescription"),
    confirmLabel: tEntity.plain("delete"),
    variant: "destructive",
  })

  return (
    <ScrollArea className="relative flex h-full flex-col">
      <div className="bg-background sticky top-0 z-10 flex shrink-0 flex-col gap-4 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base">{title}</h2>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSort}
            title={
              sortMode === "name"
                ? t.plain("sortByCount")
                : t.plain("sortByName")
            }
          >
            {sortMode === "name" ? (
              <IconSortAscending className="h-4 w-4" />
            ) : (
              <IconSortDescending className="h-4 w-4" />
            )}
          </Button>
        </div>

        <SearchInput
          placeholder={t.plain("search")}
          value={search}
          onChange={onSearchChange}
        />

        {isSelecting && entityType && itemSelection && (
          <SidebarEntityActions
            entityType={entityType}
            selectedItems={itemSelection.selectedItems}
            allItems={items}
            onStopSelecting={itemSelection.stopSelecting}
            onEdit={onEditItem}
            toShelfFilter={toShelfFilter}
          />
        )}
      </div>

      <SidebarItemList
        items={items}
        selectedKey={selectedKey}
        onItemClick={onItemClick}
        isLoading={isLoading}
        onPinItem={onPinItem}
        entityType={entityType}
        itemSelection={itemSelection}
        onOpenItemMenu={handleOpenItemMenu}
      />

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuContent
          align="end"
          className="min-w-40"
          anchor={menuAnchor}
        >
          {onEditItem && menuTarget && (
            <DropdownMenuItem
              onClick={() => {
                onEditItem(menuTarget)
                setMenuOpen(false)
              }}
            >
              <IconEdit className="mr-2 h-4 w-4" />
              {tEntity.plain("edit")}
            </DropdownMenuItem>
          )}

          {onPinItem && menuTarget && (
            <DropdownMenuItem
              onClick={() => {
                onPinItem(menuTarget)
                setMenuOpen(false)
              }}
            >
              <IconBookmarkPlus className="mr-2 h-4 w-4" />
              {t.plain("pinAsShelf")}
            </DropdownMenuItem>
          )}

          {entityType && menuTarget && (
            <>
              {(onEditItem || onPinItem) && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={(event) => {
                  rowDeleteAction.confirm(event)
                  setMenuOpen(false)
                }}
                className="text-destructive focus:text-destructive"
              >
                <IconTrash className="mr-2 h-4 w-4" />
                {tEntity.plain("delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog {...rowDeleteAction.dialogProps} />
    </ScrollArea>
  )
}

function SidebarItemList({
  items,
  selectedKey,
  onItemClick,
  isLoading,
  onPinItem,
  entityType,
  itemSelection,
  onOpenItemMenu,
}: {
  items: LibraryItem[]
  selectedKey: string | null
  onItemClick: (key: string) => void
  isLoading: boolean
  onPinItem?: (item: LibraryItem) => void
  entityType?: LibraryEntityType
  itemSelection?: ReturnType<typeof useItemSelection>
  onOpenItemMenu?: (item: LibraryItem, anchor: HTMLElement) => void
}) {
  const t = useTranslation("LibraryPage")
  const isSelecting = itemSelection?.isSelecting ?? false
  const canSelect = !!entityType && !!itemSelection
  const hasRowActions = !!onOpenItemMenu && !!entityType

  // store unstable callback references so SidebarRow doesn't receive
  // new function identities on every parent re-render
  const callbacksRef = useRef({
    onItemClick,
    onPinItem,
    onOpenItemMenu,
    itemSelection,
  })
  callbacksRef.current = {
    onItemClick,
    onPinItem,
    onOpenItemMenu,
    itemSelection,
  }

  const handleRowClick = useCallback((key: string) => {
    callbacksRef.current.onItemClick(key)
  }, [])

  const handleRowToggle = useCallback((key: string) => {
    callbacksRef.current.itemSelection?.toggleItem(key)
  }, [])

  const handleRowPin = useCallback((item: LibraryItem) => {
    callbacksRef.current.onPinItem?.(item)
  }, [])

  const handleRowMenu = useCallback(
    (item: LibraryItem, anchor: HTMLElement) => {
      callbacksRef.current.onOpenItemMenu?.(item, anchor)
    },
    [],
  )

  const pinAsShelfLabel = t.plain("pinAsShelf")

  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  useLayoutEffect(() => {
    const node = containerRef.current
    if (!node) return

    const parent = findScrollParent(node)
    setScrollElement(parent)

    if (parent) {
      setScrollMargin(node.offsetTop)
    }
  }, [])

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => SIDEBAR_ROW_HEIGHT,
    overscan: 15,
    scrollMargin,
  })

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
        {t.plain("noItemsFound")}
      </div>
    )
  }

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div className="px-2">
      <div
        ref={containerRef}
        className="relative px-2 py-1"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index]
          if (!item) return null

          return (
            <div
              key={item.key}
              className="absolute top-0 left-0 w-full"
              style={{
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              <SidebarRow
                item={item}
                isActive={item.key === selectedKey}
                isChecked={itemSelection?.isSelected(item.key) ?? false}
                isSelecting={isSelecting}
                canSelect={canSelect}
                hasRowActions={hasRowActions}
                showPin={!!onPinItem}
                pinLabel={pinAsShelfLabel}
                onItemClick={handleRowClick}
                onToggle={handleRowToggle}
                onPin={handleRowPin}
                onOpenMenu={handleRowMenu}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SidebarRow({
  item,
  isActive,
  isChecked,
  isSelecting,
  canSelect,
  hasRowActions,
  showPin,
  pinLabel,
  onItemClick,
  onToggle,
  onPin,
  onOpenMenu,
}: {
  item: LibraryItem
  isActive: boolean
  isChecked: boolean
  isSelecting: boolean
  canSelect: boolean
  hasRowActions: boolean
  showPin: boolean
  pinLabel: string
  onItemClick: (key: string) => void
  onToggle: (key: string) => void
  onPin: (item: LibraryItem) => void
  onOpenMenu: (item: LibraryItem, anchor: HTMLElement) => void
}) {
  return (
    <div
      className={cn(
        "group/item relative flex items-center rounded-md transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/50",
        isChecked && "ring-primary/40 ring-1",
      )}
    >
      {canSelect && (
        <div
          className={cn(
            "flex shrink-0 items-center pl-2",
            !isSelecting && "opacity-0 group-hover/item:opacity-100",
          )}
        >
          <Checkbox
            checked={isChecked}
            onCheckedChange={() => {
              onToggle(item.key)
            }}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (isSelecting && canSelect) {
            onToggle(item.key)
            return
          }

          onItemClick(item.key)
        }}
        className={cn(
          "flex min-w-0 flex-1 items-center py-1.5 text-left font-serif text-sm",
          canSelect ? "pr-2 pl-1.5" : "px-2",
          isActive && "font-medium",
        )}
      >
        <span className="min-w-0 truncate">{item.name}</span>
      </button>

      <div className="flex shrink-0 items-center gap-1 pr-2">
        {hasRowActions && !isSelecting && (
          <button
            type="button"
            onClick={(e) => {
              onOpenMenu(item, e.currentTarget)
            }}
            className="text-muted-foreground hover:text-foreground rounded p-0.5 opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100"
          >
            <IconDotsVertical className="size-3.5" />
          </button>
        )}

        {showPin && !isSelecting && (
          <button
            type="button"
            title={pinLabel}
            onClick={() => {
              onPin(item)
            }}
            className="text-muted-foreground hover:text-foreground rounded p-0.5 opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100"
          >
            <IconBookmarkPlus className="size-3.5" />
          </button>
        )}

        <span
          className={cn(
            "text-muted-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs tabular-nums",
            isActive && "bg-sidebar-accent-foreground text-foreground",
            hasRowActions && !isSelecting && "group-hover/item:hidden",
          )}
        >
          {item.bookCount}
        </span>
      </div>
    </div>
  )
}
