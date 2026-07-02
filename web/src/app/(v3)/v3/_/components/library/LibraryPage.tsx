"use client"

import {
  IconArrowLeft,
  IconBookmarkPlus,
  IconDotsVertical,
  IconEdit,
  IconLock,
  IconPlus,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconTrash,
} from "@tabler/icons-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { parseAsString, useQueryState } from "nuqs"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { BookFilters, BookGrid } from "@v3/_/components/books"
import { BookList } from "@v3/_/components/books/BookList"
import {
  BookDetailDrawer,
  BookListLayout,
} from "@v3/_/components/books/BookListLayout"
import { SearchInput } from "@v3/_/components/books/SearchInput"
import { SelectionToolbar } from "@v3/_/components/books/SelectionToolbar"
import { EditCreatorDialog } from "@v3/_/components/library/EditCreatorDialog"
import { EditStatusDialog } from "@v3/_/components/library/EditStatusDialog"
import { EditTagDialog } from "@v3/_/components/library/EditTagDialog"
import { SidebarEntityActions } from "@v3/_/components/library/SidebarEntityActions"
import {
  type LibraryEntityType,
  type LibraryItem,
  type LibrarySectionDef,
  NONE_KEY,
  sectionSeedQueryArg,
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
import { DynamicIcon } from "@v3/_/components/ui/dynamic-icon"
import { PageContent } from "@v3/_/components/ui/page-layout"
import { useBookFilters } from "@v3/_/hooks/use-book-filters"
import {
  BookSelectionProvider,
  useBookSelection,
} from "@v3/_/hooks/use-book-selection"
import { useItemSelection } from "@v3/_/hooks/use-item-selection"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { usePinShelf } from "@v3/_/hooks/use-pin-shelf"
import { useReportPanel } from "@v3/_/hooks/use-report-panel"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { CreateCollectionDialog } from "@/app/(v3)/v3/_/components/books/CreateCollectionDialog"
import { CreateSeriesDialog } from "@/app/(v3)/v3/_/components/books/CreateSeriesDialog"
import { CreateTagDialog } from "@/app/(v3)/v3/_/components/books/CreateTagDialog"
import { EditSeriesDialog } from "@/app/(v3)/v3/_/components/books/EditSeriesDialog"
import { CreateStatusDialog } from "@/app/(v3)/v3/_/components/library/CreateStatusDialog"
import { Dialog, DialogContent } from "@/app/(v3)/v3/_/components/ui/dialog"
import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import { isWellKnownStatus } from "@/database/statusKinds"
import { usePermissions } from "@/hooks/usePermissions"
import { type ShelfFilterNode } from "@/shelves"
import {
  type DisplayField,
  type SortContext,
  type SortDirection,
  type SortField,
  deriveDisplayFields,
} from "@/sort"
import {
  type ListBooksQueryArg,
  api,
  useDeleteCollectionMutation,
  useDeleteCreatorMutation,
  useDeleteSeriesMutation,
  useDeleteStatusMutation,
  useDeleteTagMutation,
  useGetSectionFacetsQuery,
  useListInfiniteBooksInfiniteQuery,
} from "@/store/api"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import {
  type BookView,
  selectBookView,
  selectListVisibleColumns,
  uiSettingsSlice,
} from "@/store/slices/uiSettingsSlice"
import { type UUID } from "@/uuid"

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
  const [deleteStatusMut] = useDeleteStatusMutation()

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
        case "status":
          return deleteStatusMut({ uuid }).unwrap()
      }
    },
    [
      entityType,
      deleteTag,
      deleteCreator,
      deleteSeries,
      deleteCollection,
      deleteStatusMut,
    ],
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
  // label for the "(no X)" entry shown when the section has filterNone
  noneLabel?: string
  // map format keys (or other synthetic keys) to display labels
  itemLabels?: Record<string, string>
}

function LibraryPageInner({
  title,
  section,
  defaultSidebarSort = "name",
  initialSelectedItem,
  noneLabel,
  itemLabels,
}: LibraryPageProps) {
  const t = useTranslation("LibraryPage")
  const isMobile = useIsMobile()
  const dispatch = useAppDispatch()

  const bookView = useAppSelector(selectBookView)
  const listVisibleColumns = useAppSelector(selectListVisibleColumns)

  const handleBookViewChange = useCallback(
    (view: BookView) => {
      dispatch(uiSettingsSlice.actions.setBookView(view))
    },
    [dispatch],
  )

  const handleListColumnsChange = useCallback(
    (fields: DisplayField[]) => {
      dispatch(uiSettingsSlice.actions.setListVisibleColumns(fields))
    },
    [dispatch],
  )

  const sidebarWidth = useAppSelector(
    (state) => state.uiSettings.librarySidebarWidth,
  )

  // the sidebar facet list + per-facet counts, computed in SQL (never loads the
  // whole catalog).
  const { data: facets, isLoading: facetsLoading } = useGetSectionFacetsQuery({
    section: section.key,
  })

  const [selectedItem, setSelectedItem] = useQueryState("item", parseAsString)
  const [selectedBookUuid, setSelectedBookUuid] = useQueryState(
    "book",
    parseAsString,
  )
  const [, setReportMode] = useReportPanel()

  const [sidebarSearch, setSidebarSearch] = useState("")
  const [sidebarSort, setSidebarSort] =
    useState<SidebarSortMode>(defaultSidebarSort)

  const isSeriesSection = section.entityType === "series"

  // the selected facet becomes the locked seed: a filter condition for most
  // sections, or a native series / collection sort-context arg (so getBooks can
  // resolve series-position ordering and reuse its membership filters).
  const seedArg = useMemo<ListBooksQueryArg>(
    () => (selectedItem ? sectionSeedQueryArg(section, selectedItem) : {}),
    [section, selectedItem],
  )

  // series pages default to ordering by position (overridable in the sort menu).
  const controller = useBookFilters({
    seed: seedArg.filter ?? null,
    seriesContext: seedArg.series as UUID | undefined,
    collectionContext: seedArg.collection as UUID | undefined,
    ...(isSeriesSection
      ? {
          defaultSortField: "seriesPosition" as const,
          defaultSortDirection: "asc" as const,
        }
      : {}),
  })

  const {
    queryArg,
    sort,
    setSort,
    displayOverrides,
    isSearching,
    deferredSearch,
    activeFilterCount,
    clearAll,
  } = controller

  const handleColumnSort = useCallback(
    (field: SortField, direction: SortDirection) => {
      setSort(field, direction)
    },
    [setSort],
  )

  // on a series page the books carry a position within the selected series;
  // used both to sort by position and to show it on the cards.
  const seriesContextUuid = isSeriesSection
    ? (selectedItem as UUID | null)
    : null
  const displayContext = useMemo<SortContext>(
    () => ({ seriesUuid: seriesContextUuid }),
    [seriesContextUuid],
  )

  const displayFields = deriveDisplayFields(
    sort.field,
    displayContext,
    displayOverrides,
  )

  // the server returns the facet list; the client only relabels the synthetic
  // "(no X)" bucket and any format keys.
  const allItems = useMemo<LibraryItem[]>(() => {
    if (!facets) return []

    return facets.flatMap((facet) => {
      if (facet.key === NONE_KEY) {
        if (!noneLabel) return []
        return [{ key: NONE_KEY, name: noneLabel, bookCount: facet.bookCount }]
      }

      return [
        {
          key: facet.key,
          name: itemLabels?.[facet.key] ?? facet.name,
          bookCount: facet.bookCount,
          icon: facet.icon,
          color: facet.color,
        },
      ]
    })
  }, [facets, noneLabel, itemLabels])

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

  const didAutoSelectRef = useRef(false)

  // auto-select the initial item if it's not already selected and we're not on mobile
  useEffect(() => {
    if (selectedItem || didAutoSelectRef.current || isMobile) return

    const initial =
      initialSelectedItem && allItems.some((i) => i.key === initialSelectedItem)
        ? initialSelectedItem
        : visibleItems.find((i) => i.key !== NONE_KEY)?.key

    if (initial) {
      didAutoSelectRef.current = true
      void setSelectedItem(initial)
    }
  }, [
    selectedItem,
    isMobile,
    visibleItems,
    allItems,
    initialSelectedItem,
    setSelectedItem,
  ])

  const gridArg = queryArg

  const {
    data: gridData,
    isLoading: gridLoading,
    isFetching: gridFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useListInfiniteBooksInfiniteQuery(gridArg, { skip: !selectedItem })

  const filteredBooks = useMemo(
    () => gridData?.pages.flatMap((page) => page) ?? [],
    [gridData?.pages],
  )

  const selectedFacet = allItems.find((i) => i.key === selectedItem)
  const selectedItemName = selectedFacet?.name

  const filteredBookUuids = useMemo(
    () => filteredBooks.map((book) => book.uuid),
    [filteredBooks],
  )

  // the detail panel fetches by uuid; this only seeds its cache when the book is
  // already on a loaded page (deep links still resolve via the fetch).
  const selectedBook = useMemo(
    () => filteredBooks.find((b) => b.uuid === selectedBookUuid),
    [filteredBooks, selectedBookUuid],
  )

  const handleSidebarWidthChange = useCallback(
    (width: number) => {
      dispatch(uiSettingsSlice.actions.setLibrarySidebarWidth(width))
    },
    [dispatch],
  )

  // switching facets closes the open book panel (the grid is now paginated, so
  // there's no cheap "first book of the next facet" to jump to). functional
  // updates keep these callbacks stable so the virtualized sidebar doesn't churn.
  const handleItemClick = useCallback(
    (key: string) => {
      void setSelectedItem((current) => (key === current ? null : key))
      void setSelectedBookUuid(null)
    },
    [setSelectedItem, setSelectedBookUuid],
  )

  // warm the grid query for a facet on hover so clicking it feels instant.
  // subscribe:false caches the first page without leaving a live subscription.
  // rebuilt from sort + search (not the current queryArg) so hovering a
  // different facet swaps in that facet's seed; warms the common no-extra-filter
  // case, which is enough to make the click feel instant.
  const prefetchDepsRef = useRef({ sort, deferredSearch, section })
  prefetchDepsRef.current = { sort, deferredSearch, section }
  const handleHoverItem = useCallback(
    (key: string) => {
      const {
        sort: s,
        deferredSearch: ds,
        section: sec,
      } = prefetchDepsRef.current
      void dispatch(
        api.endpoints.listInfiniteBooks.initiate(
          {
            orderBy: s.field,
            orderDirection: s.direction,
            ...(ds ? { search: ds } : {}),
            ...sectionSeedQueryArg(sec, key),
          },
          { subscribe: false },
        ),
      )
    },
    [dispatch],
  )

  const {
    isSelecting: isSelectingBooks,
    toggleSelection: toggleBookSelection,
  } = useBookSelection()
  const handleBookClick = useCallback(
    (book: { uuid: string }) => {
      if (isSelectingBooks) {
        toggleBookSelection(book.uuid)
        return
      }

      void setReportMode(false)
      void setSelectedBookUuid(book.uuid)
    },
    [setReportMode, setSelectedBookUuid, isSelectingBooks, toggleBookSelection],
  )

  // alignment grade/score cell opens the panel straight into the report.
  const handleColumnClick = useCallback(
    (book: { uuid: string }) => {
      void setReportMode(true)
      void setSelectedBookUuid(book.uuid)
    },
    [setReportMode, setSelectedBookUuid],
  )

  const handleClosePanel = useCallback(() => {
    void setSelectedBookUuid(null)
    void setReportMode(false)
  }, [setReportMode, setSelectedBookUuid])

  const handleBackToList = useCallback(() => {
    void setSelectedItem(null)
    void setSelectedBookUuid(null)
  }, [setSelectedItem, setSelectedBookUuid])

  const tEntity = useTranslation("EntityActions")
  const c = useCommon()
  const { pinShelf, isPinning } = usePinShelf()
  const canPin = !!section.toShelfFilter
  const entityType = section.entityType

  const isSelectedCoreStatus =
    entityType === "status" &&
    !!selectedFacet?.kind &&
    isWellKnownStatus(selectedFacet.kind)

  const itemSelection = useItemSelection()

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<LibraryItem | null>(null)

  const handleEditItem = useCallback((item: LibraryItem) => {
    setEditItem(item)
    setEditDialogOpen(true)
  }, [])

  const permissions = usePermissions()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  // tags/series creation reuses the bookUpdate permission (same as their
  // add-to-book routes); collections have a dedicated one.
  const canCreate =
    (entityType === "collection" && !!permissions?.collectionCreate) ||
    ((entityType === "tag" || entityType === "series") &&
      !!permissions?.bookUpdate) ||
    (entityType === "status" && !!permissions?.settingsUpdate)

  const createLabel =
    entityType === "collection"
      ? tEntity("createCollection")
      : entityType === "tag"
        ? tEntity("createTag")
        : entityType === "series"
          ? tEntity("createSeries")
          : entityType === "status"
            ? tEntity("createStatus")
            : undefined

  const handleCreateItem = useCallback(() => {
    setCreateDialogOpen(true)
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
    title: tEntity("deleteTitle", {
      count: 1,
      entity: entityType
        ? tEntity(`entityTypes.${entityType}` as "entityTypes.tag", {
            count: 1,
          })
        : "",
    }),
    description: tEntity("deleteDescription"),
    confirmLabel: c("actions.delete"),
    variant: "destructive",
  })

  const showMuted =
    isSearching ||
    (gridFetching && !isFetchingNextPage && filteredBooks.length > 0)

  const sidebarContent = (
    <SidebarPanel
      title={title}
      items={visibleItems}
      selectedKey={selectedItem}
      isLoading={facetsLoading}
      search={sidebarSearch}
      onSearchChange={setSidebarSearch}
      sortMode={sidebarSort}
      onSortModeChange={setSidebarSort}
      onItemClick={handleItemClick}
      onHoverItem={handleHoverItem}
      entityType={entityType}
      itemSelection={itemSelection}
      onEditItem={entityType ? handleEditItem : undefined}
      toShelfFilter={section.toShelfFilter}
      {...(canPin && { onPinItem: handlePinFacet })}
      {...(canCreate && {
        onCreate: handleCreateItem,
        createLabel,
      })}
    />
  )

  const booksContent = (
    <>
      <BookFilters
        className="pt-1"
        controller={controller}
        seedLabel={selectedItemName}
        hasSeriesContext={!!seriesContextUuid}
        bookView={bookView}
        onBookViewChange={handleBookViewChange}
      />

      <PageContent className="p-4">
        {bookView === "list" ? (
          <BookList
            books={filteredBooks}
            isLoading={gridLoading}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            fetchNextPage={fetchNextPage}
            showMuted={showMuted}
            emptySubMessage={
              deferredSearch || activeFilterCount > 0
                ? "Try adjusting your search or filters"
                : undefined
            }
            onClearFilters={clearAll}
            hasActiveFilters={activeFilterCount > 0}
            selectedBookUuid={selectedBookUuid}
            onBookClick={handleBookClick}
            onColumnClick={handleColumnClick}
            displayFields={displayFields}
            displayContext={displayContext}
            visibleColumns={listVisibleColumns}
            onVisibleColumnsChange={handleListColumnsChange}
            sortField={sort.field}
            sortDirection={sort.direction}
            onSortChange={handleColumnSort}
          />
        ) : (
          <BookGrid
            books={filteredBooks}
            isLoading={gridLoading}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            fetchNextPage={fetchNextPage}
            showMuted={showMuted}
            emptySubMessage={
              deferredSearch || activeFilterCount > 0
                ? "Try adjusting your search or filters"
                : undefined
            }
            onClearFilters={clearAll}
            hasActiveFilters={activeFilterCount > 0}
            selectedBookUuid={selectedBookUuid}
            onBookClick={handleBookClick}
            displayFields={displayFields}
            displayContext={displayContext}
          />
        )}

        {filteredBooks.length === 0 && (
          <div className="text-muted-foreground flex h-[50vh] flex-col items-center justify-center gap-2">
            <IconSearch className="h-12 w-12 opacity-40" />
            <p className="text-lg font-medium">{t("emptyState")}</p>
          </div>
        )}
      </PageContent>
      <SelectionToolbar allBookUuids={filteredBookUuids} />
    </>
  )

  const createDialog = !canCreate ? null : entityType === "collection" ? (
    <CreateCollectionDialog
      open={createDialogOpen}
      onOpenChange={setCreateDialogOpen}
    />
  ) : entityType === "tag" ? (
    <CreateTagDialog
      open={createDialogOpen}
      onOpenChange={setCreateDialogOpen}
    />
  ) : entityType === "status" ? (
    <CreateStatusDialog
      open={createDialogOpen}
      onOpenChange={setCreateDialogOpen}
    />
  ) : (
    <CreateSeriesDialog
      open={createDialogOpen}
      onOpenChange={setCreateDialogOpen}
    />
  )

  const headerActions = (
    <>
      {selectedItem && selectedItemName && selectedItem !== NONE_KEY ? (
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
                {c("actions.edit")}
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
                {t("pinAsShelf")}
              </DropdownMenuItem>
            )}

            {entityType && !isSelectedCoreStatus && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(event) => {
                    headerDeleteAction.confirm(event)
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <IconTrash className="mr-2 h-4 w-4" />
                  {c("actions.delete")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : undefined}
    </>
  )
  const editDialog = entityType ? (
    <EntityEditDialog
      entityType={entityType}
      open={editDialogOpen}
      onOpenChange={setEditDialogOpen}
      item={editItem}
    />
  ) : null

  if (isMobile) {
    console.log("selectedItem", selectedItem)
    // if (selectedItem && selectedItemName) {
    return (
      <>
        <MobileBookView
          title={title}
          selectedItemName={selectedItemName}
          onBack={handleBackToList}
          actions={headerActions}
        >
          {booksContent}
        </MobileBookView>

        <BookDetailDrawer
          selectedBookUuid={selectedBookUuid}
          selectedBook={selectedBook}
          onClose={handleClosePanel}
        />
        <Dialog open={!selectedItem} defaultOpen={!selectedItem}>
          <DialogContent>{sidebarContent}</DialogContent>
        </Dialog>
        {editDialog}
        {createDialog}
      </>
    )
    // }

    return (
      <div className="flex h-screen flex-col">
        {/* <div className="relative h-(--header-height) w-full shrink-0">
          <SiteHeader breadcrumbs={[{ label: title }]} />
        </div> */}
        <div className="flex-1">{sidebarContent}</div>
        {createDialog}
      </div>
    )
  }

  return (
    <>
      <BookListLayout
        sidebar={sidebarContent}
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={handleSidebarWidthChange}
        headerBreadcrumbs={[{ label: selectedItemName ?? title }]}
        headerActions={headerActions}
        selectedBookUuid={selectedBookUuid}
        selectedBook={selectedBook}
        onClosePanel={handleClosePanel}
      >
        {booksContent}
      </BookListLayout>

      {editDialog}
      {createDialog}
      <ConfirmDialog {...headerDeleteAction.dialogProps} />
    </>
  )
}

function MobileBookView({
  title,
  selectedItemName,
  onBack,
  children,
  actions,
}: {
  title: string
  selectedItemName: string
  onBack: () => void
  children: React.ReactNode
  actions: React.ReactNode
}) {
  const c = useCommon()
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="relative h-(--header-height) w-full shrink-0">
        <SiteHeader
          breadcrumbs={[{ label: title }, { label: selectedItemName }]}
          actions={
            <>
              <TooltipButton
                tooltip={c("actions.back")}
                aria-label={c("actions.back")}
                className="bg-background/90 rounded-full backdrop-blur"
                variant="secondary"
                size="sm"
                onClick={onBack}
              >
                <IconArrowLeft className="size-3.5 stroke-[1.5]" />
              </TooltipButton>
              {actions}
            </>
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

  if (entityType === "series") {
    return (
      <EditSeriesDialog
        open={open}
        onOpenChange={onOpenChange}
        series={
          item ? { uuid: item.key, name: item.name, description: null } : null
        }
      />
    )
  }

  if (entityType === "status") {
    return (
      <EditStatusDialog
        open={open}
        onOpenChange={onOpenChange}
        status={item ? { uuid: item.key, name: item.name } : null}
      />
    )
  }

  // the only remaining entity type is "collection"
  return (
    <CreateCollectionDialog
      open={open}
      onOpenChange={onOpenChange}
      collectionUuid={item ? item.key : null}
    />
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
  onHoverItem,
  onPinItem,
  entityType,
  itemSelection,
  onEditItem,
  onCreate,
  createLabel,
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
  onHoverItem?: (key: string) => void
  onPinItem?: (item: LibraryItem) => void
  entityType?: LibraryEntityType
  itemSelection?: ReturnType<typeof useItemSelection>
  onEditItem?: (item: LibraryItem) => void
  onCreate?: () => void
  createLabel?: string
  toShelfFilter?: (itemKey: string) => ShelfFilterNode
}) {
  const t = useTranslation("LibraryPage")
  const tEntity = useTranslation("EntityActions")
  const c = useCommon()

  const toggleSort = useCallback(() => {
    onSortModeChange(sortMode === "name" ? "count" : "name")
  }, [sortMode, onSortModeChange])

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
      ? tEntity("deleteTitle", {
          count: 1,
          entity: entityType
            ? tEntity(`entityTypes.${entityType}` as "entityTypes.tag", {
                count: 1,
              })
            : "",
        })
      : "",
    description: tEntity("deleteDescription"),
    confirmLabel: c("actions.delete"),
    variant: "destructive",
  })

  return (
    <div className="scroll-y relative flex h-full flex-col">
      <div className="flex h-full flex-col">
        <div className="bg-background sticky top-0 z-10 flex shrink-0 flex-col gap-4 px-3 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base">{title}</h2>

            <div className="flex items-center gap-0.5">
              {onCreate && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onCreate}
                  title={createLabel}
                >
                  <IconPlus className="h-4 w-4" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleSort}
                title={sortMode === "name" ? t("sortByCount") : t("sortByName")}
              >
                {sortMode === "name" ? (
                  <IconSortAscending className="h-4 w-4" />
                ) : (
                  <IconSortDescending className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <SearchInput
            placeholder={t("search")}
            value={search}
            onChange={onSearchChange}
          />
        </div>

        <SidebarItemList
          items={items}
          selectedKey={selectedKey}
          onItemClick={onItemClick}
          onHoverItem={onHoverItem}
          isLoading={isLoading}
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
                {c("actions.edit")}
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
                {t("pinAsShelf")}
              </DropdownMenuItem>
            )}

            {entityType &&
              menuTarget &&
              !(
                entityType === "status" &&
                menuTarget.kind &&
                isWellKnownStatus(menuTarget.kind)
              ) && (
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
                    {c("actions.delete")}
                  </DropdownMenuItem>
                </>
              )}
          </DropdownMenuContent>
        </DropdownMenu>

        <ConfirmDialog {...rowDeleteAction.dialogProps} />
      </div>

      {entityType && entityType !== "status" && itemSelection && (
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
  )
}

function SidebarItemList({
  items,
  selectedKey,
  onItemClick,
  onHoverItem,
  isLoading,
  entityType,
  itemSelection,
  onOpenItemMenu,
}: {
  items: LibraryItem[]
  selectedKey: string | null
  onItemClick: (key: string) => void
  onHoverItem?: (key: string) => void
  isLoading: boolean
  entityType?: LibraryEntityType
  itemSelection?: ReturnType<typeof useItemSelection>
  onOpenItemMenu?: (item: LibraryItem, anchor: HTMLElement) => void
}) {
  const isSelecting = itemSelection?.isSelecting ?? false
  const canSelect = !!entityType && !!itemSelection
  const hasRowActions = !!onOpenItemMenu && !!entityType

  // store unstable callback references so SidebarRow doesn't receive
  // new function identities on every parent re-render
  const callbacksRef = useRef({
    onItemClick,
    onHoverItem,
    onOpenItemMenu,
    itemSelection,
  })
  callbacksRef.current = {
    onItemClick,
    onHoverItem,
    onOpenItemMenu,
    itemSelection,
  }

  const c = useCommon()

  const handleRowClick = useCallback((key: string) => {
    callbacksRef.current.onItemClick(key)
  }, [])

  const handleRowHover = useCallback((key: string) => {
    callbacksRef.current.onHoverItem?.(key)
  }, [])

  const handleRowToggle = useCallback((key: string) => {
    callbacksRef.current.itemSelection?.toggleItem(key)
  }, [])

  const handleRowMenu = useCallback(
    (item: LibraryItem, anchor: HTMLElement) => {
      callbacksRef.current.onOpenItemMenu?.(item, anchor)
    },
    [],
  )

  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  // callback ref so the scroll parent is found when the list actually mounts
  // (not during the loading skeleton phase when the container isn't in the DOM)
  const containerRef = useCallback((node: HTMLDivElement | null) => {
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
        {c("empty.noItemsFound")}
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
                canSelect={canSelect && item.key !== NONE_KEY}
                hasRowActions={hasRowActions && item.key !== NONE_KEY}
                onItemClick={handleRowClick}
                onHover={handleRowHover}
                onToggle={handleRowToggle}
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
  onItemClick,
  onHover,
  onToggle,
  onOpenMenu,
}: {
  item: LibraryItem
  isActive: boolean
  isChecked: boolean
  isSelecting: boolean
  canSelect: boolean
  hasRowActions: boolean
  onItemClick: (key: string) => void
  onHover: (key: string) => void
  onToggle: (key: string) => void
  onOpenMenu: (item: LibraryItem, anchor: HTMLElement) => void
}) {
  return (
    <div
      className={cn(
        "group/item relative flex items-center rounded-md",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/50",
        isChecked && "ring-primary/40 ring-1 ring-inset",
      )}
    >
      <button
        type="button"
        onMouseEnter={() => {
          onHover(item.key)
        }}
        onClick={() => {
          if (isSelecting && canSelect) {
            onToggle(item.key)
            return
          }

          onItemClick(item.key)
        }}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left font-serif text-sm",
          canSelect ? "pr-2 pl-1.5" : "px-2",
          isActive && "font-medium",
        )}
      >
        {item.icon ? (
          <DynamicIcon
            iconId={item.icon}
            color={item.color}
            className="size-4 shrink-0"
          />
        ) : item.color ? (
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
        ) : null}
        <span className="min-w-0 truncate">{item.name}</span>

        {item.kind && isWellKnownStatus(item.kind) && (
          <IconLock className="text-muted-foreground/60 size-3 shrink-0" />
        )}
      </button>

      <div className="flex shrink-0 items-center gap-1 pr-2">
        {hasRowActions && !isSelecting && (
          <button
            type="button"
            onClick={(e) => {
              onOpenMenu(item, e.currentTarget)
            }}
            className="text-muted-foreground hover:text-foreground pointer-events-none invisible rounded p-0.5 opacity-0 transition-opacity group-hover/item:pointer-events-auto group-hover/item:visible group-hover/item:opacity-100 peer-focus/item:pointer-events-auto peer-focus/item:visible peer-focus/item:opacity-100 focus-visible:opacity-100"
          >
            <IconDotsVertical className="size-3.5" />
          </button>
        )}

        {canSelect && (
          <div
            className={cn(
              "pr-.5 flex shrink-0 items-center",

              !isSelecting &&
                "hidden opacity-0 group-hover/item:block group-hover/item:opacity-100 peer-focus/item:block peer-focus/item:opacity-100",
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

        <span
          className={cn(
            "text-muted-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs tabular-nums",
            isActive && "bg-sidebar-accent-foreground text-foreground",
            isSelecting && "hidden",
            hasRowActions && !isSelecting && "group-hover/item:hidden",
          )}
        >
          {item.bookCount}
        </span>
      </div>
    </div>
  )
}

export function LibraryPage(props: LibraryPageProps) {
  return (
    <BookSelectionProvider>
      <LibraryPageInner {...props} />
    </BookSelectionProvider>
  )
}
