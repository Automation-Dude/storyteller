"use client"

import { useHotkey } from "@tanstack/react-hotkeys"
import dynamic from "next/dynamic"
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { BookFilters } from "@v3/_/components/books"
import {
  BookDetailDrawer,
  SkipToBooksLink,
} from "@v3/_/components/books/BookListLayout"
import { BooksView } from "@v3/_/components/books/BooksView"
import { SelectionToolbar } from "@v3/_/components/books/SelectionToolbar"
import {
  BOOK_COLLECTION_ID,
  BOOK_DETAIL_PANEL_ID,
} from "@v3/_/components/books/keyboard-nav"
import {
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  PageContent,
  PageHeader,
  PageLayout,
  PageMain,
  PagePanel,
  PageSidebar,
} from "@v3/_/components/ui/page-layout"
import {
  type BookFiltersController,
  useBookFilters,
} from "@v3/_/hooks/use-book-filters"
import {
  BookSelectionProvider,
  useBookSelection,
} from "@v3/_/hooks/use-book-selection"
import { useBookInSidePanel } from "@v3/_/hooks/use-open-book"
import { useReportPanel } from "@v3/_/hooks/use-report-panel"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { SiteHeader } from "@/app/(v3)/v3/_/components/site-header"
import { useSidebar } from "@/app/(v3)/v3/_/components/ui/sidebar"
import { useUserPreferences } from "@/app/(v3)/v3/_/components/user-preferences-provider"
import { useLayoutAnimations } from "@/app/(v3)/v3/_/hooks/use-layout-animations"
import { useIsMobile } from "@/app/(v3)/v3/_/hooks/use-mobile"
import { usePanelWidthDriver } from "@/app/(v3)/v3/_/hooks/use-panel-width-driver"
import { type BookWithRelations } from "@/database/books"
import { type ShelfFilterNode } from "@/shelves"
import {
  type BookSort,
  type DisplayField,
  GENERAL_SORT_FIELDS,
  type SortContext,
  type SortDirection,
  type SortField,
  deriveDisplayFields,
} from "@/sort"
import {
  type ListShelfBooksQueryArg,
  useListInfiniteBooksInfiniteQuery,
  useListInfiniteShelfBooksInfiniteQuery,
} from "@/store/api"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import {
  selectGridDisplayFields,
  uiSettingsSlice,
} from "@/store/slices/uiSettingsSlice"
import { type UUID } from "@/uuid"

import { BookDetailsSkeleton } from "./BookDetails/BookDetailsSkeleton"
import { useCoverScope } from "./BookDetails/sections/CoverScope"
import { GRID_CARD_WIDTHS, GRID_SPACING_PX } from "./Grid/BookGrid"
import { PanelDraggingProvider } from "./panel-resize-context"

const DynamicBookDetailsContent = dynamic(
  () =>
    import("@/app/(v3)/v3/_/components/books/BookDetails/BookDetailsPage").then(
      (mod) => mod.BookDetailsContent,
    ),
  {
    ssr: false,
    loading: () => <BookDetailsSkeleton compact={true} />,
  },
)

export type BookListSource =
  | {
      kind: "books"
      // locked filter contributed by the page context, ANDed into the query
      seed?: ShelfFilterNode | null
      // native sort-context args (series-position ordering, membership)
      seriesContext?: UUID
      collectionContext?: UUID
      limit?: number
    }
  | { kind: "shelf"; shelfUuid: UUID }

export type BookListBreadcrumbs = (
  | { label: string; url?: string }
  | { render: ReactNode }
)[]

type BookListPageProps = {
  source: BookListSource
  // suspend fetching while the page has nothing selected yet
  skip?: boolean

  seedLabel?: string | undefined
  defaultSort?: BookSort[number] | undefined
  // page-specific sort fields shown before the general ones (e.g. seriesPosition)
  extraSortFields?: SortField[]

  breadcrumbs: BookListBreadcrumbs
  headerActions?: ReactNode
  sidebar?: ReactNode
  beforeFilters?: ReactNode
  afterFilters?: ReactNode
  filtersClassName?: string
  contentClassName?: string

  // what a plain click on a book opens in the side panel
  bookClickMode?: "panel" | "report"
  // next/previous stepping from the detail panel (+ prefetch near the end)
  enableBookStepping?: boolean

  emptyMessage?: string
  // shown when the list is empty without any active search/filter
  emptySubMessage?: string
  // shown when the list is empty because of an active search/filter
  emptyFilteredSubMessage?: string
}

type BookListPageState = {
  controller: BookFiltersController
  books: BookWithRelations[]
  isLoading: boolean
  selectedBookUuid: string | null
  displayFields: DisplayField[]
  displayContext: SortContext
}

const BookListPageContext = createContext<BookListPageState | null>(null)

export function useBookListPageState(): BookListPageState {
  const state = useContext(BookListPageContext)
  if (!state) {
    throw new Error("useBookListPageState must be used inside <BookListPage>")
  }
  return state
}

// for components that may render either inside or outside a BookListPage
export function useOptionalBookListPageState(): BookListPageState | null {
  return useContext(BookListPageContext)
}

const NEXT_PREFETCH_MARGIN = 3

function BookListPageInner({
  source,
  skip = false,
  seedLabel,
  defaultSort,
  extraSortFields,
  breadcrumbs,
  headerActions,
  sidebar,
  beforeFilters,
  afterFilters,
  filtersClassName,
  contentClassName,
  bookClickMode = "panel",
  enableBookStepping = false,
  emptyMessage,
  emptySubMessage,
  emptyFilteredSubMessage,
}: BookListPageProps) {
  const dispatch = useAppDispatch()

  const gridDisplayFields = useAppSelector(selectGridDisplayFields)

  const handleDisplayFieldsChange = useCallback(
    (fields: DisplayField[] | null) => {
      dispatch(uiSettingsSlice.actions.setGridDisplayFields(fields))
    },
    [dispatch],
  )

  const sidebarWidth = useAppSelector(
    (state) => state.uiSettings.librarySidebarWidth,
  )
  const handleSidebarWidthChange = useCallback(
    (width: number) => {
      dispatch(uiSettingsSlice.actions.setLibrarySidebarWidth(width))
    },
    [dispatch],
  )

  const isBooksSource = source.kind === "books"
  console.log(source)

  const controller = useBookFilters({
    seed: (isBooksSource ? source.seed : null) ?? null,
    ...(isBooksSource && source.seriesContext
      ? { seriesContext: source.seriesContext }
      : {}),
    ...(isBooksSource && source.collectionContext
      ? { collectionContext: source.collectionContext }
      : {}),
    defaultSort,
  })

  const {
    queryArg,
    effectiveFilter,
    sort,
    setSort,
    isSearching,
    deferredSearch,
    activeFilterCount,
    clearAll,
  } = controller

  const tLabel = useTranslation("Common.fields.label")
  const sortFieldOptions = useMemo<
    { value: SortField; label: string }[]
  >(() => {
    const fields: SortField[] = [
      ...(extraSortFields ?? []),
      ...GENERAL_SORT_FIELDS,
    ]
    return fields.map((value) => ({ value, label: tLabel(value) }))
  }, [extraSortFields, tLabel])

  const booksQueryResult = useListInfiniteBooksInfiniteQuery(
    {
      ...queryArg,
      ...(isBooksSource && source.limit ? { limit: source.limit } : {}),
    },
    { skip: skip || !isBooksSource },
  )

  const shelfQueryArg = useMemo<ListShelfBooksQueryArg>(
    () => ({
      shelfUuid: source.kind === "shelf" ? source.shelfUuid : "",
      sortField: sort.field,
      orderDirection: sort.direction,
      ...(deferredSearch ? { search: deferredSearch } : {}),
      ...(effectiveFilter ? { filter: effectiveFilter } : {}),
    }),
    [source, sort, deferredSearch, effectiveFilter],
  )
  // this could technically also be a books query, but w a filter, buuuuut
  // lets just do it like this for now.
  const shelfQueryResult = useListInfiniteShelfBooksInfiniteQuery(
    shelfQueryArg,
    { skip: skip || source.kind !== "shelf" },
  )

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = source.kind === "shelf" ? shelfQueryResult : booksQueryResult

  const books = useMemo(
    () => data?.pages.flatMap((page) => page) ?? [],
    [data?.pages],
  )

  const { selectedBookUuid, setSelectedBookUuid } = useBookInSidePanel()
  const [, setReportMode] = useReportPanel()
  const { isSelecting, toggleSelection } = useBookSelection()

  const selectedBook = useMemo(
    () => books.find((b) => b.uuid === selectedBookUuid),
    [books, selectedBookUuid],
  )

  const handleBookClick = useCallback(
    (
      book: { uuid: string },
      isSelectingArg?: boolean,
      isBookSelected?: boolean,
    ) => {
      if (isSelecting || isSelectingArg || isBookSelected) {
        toggleSelection(book.uuid)
        return
      }

      void setReportMode(bookClickMode === "report")
      void setSelectedBookUuid(book.uuid)
    },
    [
      isSelecting,
      toggleSelection,
      setReportMode,
      setSelectedBookUuid,
      bookClickMode,
    ],
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
    // hand focus back to the grid/list so keyboard users aren't dumped at the
    // top of the document when the panel closes.
    requestAnimationFrame(() => {
      document.getElementById(BOOK_COLLECTION_ID)?.focus()
    })
  }, [setReportMode, setSelectedBookUuid])

  const handleColumnSort = useCallback(
    (field: SortField, direction: SortDirection) => {
      setSort(field, direction)
    },
    [setSort],
  )

  // -- next/previous stepping from the detail panel ------------------------

  const bookUuids = useMemo<string[]>(() => books.map((b) => b.uuid), [books])
  const selectedIndex =
    enableBookStepping && selectedBookUuid
      ? bookUuids.indexOf(selectedBookUuid)
      : -1

  useEffect(() => {
    if (!enableBookStepping || selectedIndex < 0) return

    const remaining = bookUuids.length - 1 - selectedIndex
    if (
      remaining <= NEXT_PREFETCH_MARGIN &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage()
    }
  }, [
    enableBookStepping,
    selectedIndex,
    bookUuids.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ])

  const goToNext = useMemo(() => {
    if (!enableBookStepping) return undefined
    const atEnd = selectedIndex >= bookUuids.length - 1
    if (selectedIndex < 0 || (atEnd && !hasNextPage)) return undefined
    return () => {
      const next = bookUuids[selectedIndex + 1]
      if (next) void setSelectedBookUuid(next)
    }
  }, [
    enableBookStepping,
    selectedIndex,
    bookUuids,
    hasNextPage,
    setSelectedBookUuid,
  ])

  const goToPrevious = useMemo(() => {
    if (!enableBookStepping || selectedIndex <= 0) return undefined
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return () => void setSelectedBookUuid(bookUuids[selectedIndex - 1]!)
  }, [enableBookStepping, selectedIndex, bookUuids, setSelectedBookUuid])

  // -- display fields -------------------------------------------------------

  const displayContext = useMemo<SortContext>(
    () => ({
      seriesUuid: (isBooksSource ? source.seriesContext : null) ?? null,
    }),
    [isBooksSource, source],
  )

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

  const showMuted =
    isSearching || (isFetching && !isFetchingNextPage && books.length > 0)

  const hasActiveFilters = !!deferredSearch || activeFilterCount > 0

  const contextValue = useMemo<BookListPageState>(
    () => ({
      controller,
      books,
      isLoading,
      selectedBookUuid,
      displayFields,
      displayContext,
    }),
    [
      controller,
      books,
      isLoading,
      selectedBookUuid,
      displayFields,
      displayContext,
    ],
  )

  // --- book list layout

  const isMobile = useIsMobile()

  const focusCollection = useCallback(() => {
    document.getElementById(BOOK_COLLECTION_ID)?.focus()
  }, [])

  // "go to books": jump focus straight into the collection from anywhere
  useHotkey("G", focusCollection, { ignoreInputs: true })

  const panelWidth = useAppSelector(
    (state) => state.uiSettings.detailPanelWidth,
  )
  const bookLayout = useAppSelector((state) => state.uiSettings.bookLayout)

  const panelOpen = !!selectedBookUuid
  const animate = useLayoutAnimations() && !isMobile

  const handlePanelWidthChange = useCallback(
    (width: number) => {
      dispatch(uiSettingsSlice.actions.setDetailPanelWidth(width))
    },
    [dispatch],
  )

  const { animatePanelOpen } = useUserPreferences()

  const gridCardSize = useAppSelector((state) => state.uiSettings.gridCardSize)
  const gridSpacing = useAppSelector((state) => state.uiSettings.gridSpacing)
  const cardWidth = GRID_CARD_WIDTHS[gridCardSize]
  const gridGap = GRID_SPACING_PX[gridSpacing]

  const pageLayoutRef = useRef<HTMLDivElement>(null)

  const GRID_PADDING = 48 // PageContent p-6 (24px each side)

  // TODO: remove?
  const snapChromeWidth = useCallback(
    (rawWidth: number, otherChrome: number, minW: number, maxW: number) => {
      const layoutWidth =
        pageLayoutRef.current?.offsetWidth ?? window.innerWidth

      const pitch = cardWidth + gridGap
      const available = layoutWidth - otherChrome - GRID_PADDING

      const gridWidth = available - rawWidth
      const idealCols = Math.max(1, Math.round((gridWidth + gridGap) / pitch))

      // walk outward from the ideal column count until we find one whose
      // chrome width falls within [minW, maxW]. at most one step needed
      // in each direction since the pitch is large relative to the bounds.
      for (let delta = 0; delta <= idealCols; delta++) {
        for (const d of delta === 0 ? [0] : [-delta, delta]) {
          const cols = idealCols + d
          if (cols < 1) continue

          const chrome = available - (cols * pitch - gridGap)
          if (chrome >= minW && chrome <= maxW) return chrome
        }
      }

      return Math.max(
        minW,
        Math.min(maxW, available - (idealCols * pitch - gridGap)),
      )
    },
    [cardWidth, gridGap, GRID_PADDING],
  )

  const snapPanelWidth = useCallback(
    (raw: number) =>
      snapChromeWidth(
        raw,
        sidebar ? sidebarWidth : 0,
        MIN_PANEL_WIDTH,
        MAX_PANEL_WIDTH,
      ),
    [snapChromeWidth, sidebar, sidebarWidth],
  )

  const driver = usePanelWidthDriver({
    open: panelOpen && !isMobile,
    storedWidth: panelWidth,
    animate,
    // `animate` keeps the grid FLIP on; this only toggles the open/close slide,
    // so both feels can be compared from the preference.
    animateOpenClose: animate && animatePanelOpen,
    snapOnRelease:
      !animate && bookLayout === "grid" ? snapPanelWidth : undefined,
    commit: handlePanelWidthChange,
  })

  const { state: sidebarState } = useSidebar()
  const [sidebarResizing, setSidebarResizing] = useState(false)
  const prevSidebarState = useRef(sidebarState)
  useLayoutEffect(() => {
    if (prevSidebarState.current === sidebarState) return
    prevSidebarState.current = sidebarState
    setSidebarResizing(true)
    const id = setTimeout(() => {
      setSidebarResizing(false)
    }, 260)
    return () => {
      clearTimeout(id)
    }
  }, [sidebarState])

  // keep the closing panel's content mounted while it slides shut
  // very annoying
  const lastSelectedRef = useRef<{
    uuid: string
    book: BookWithRelations | undefined
  } | null>(null)
  useEffect(() => {
    if (selectedBookUuid) {
      lastSelectedRef.current = { uuid: selectedBookUuid, book: selectedBook }
    }
  }, [selectedBookUuid, selectedBook])

  const shownUuid =
    selectedBookUuid ??
    (animate && driver.visible ? lastSelectedRef.current?.uuid ?? null : null)
  const shownBook = selectedBookUuid
    ? selectedBook
    : lastSelectedRef.current?.book

  // re-snap the stored panel width so the grid starts with whole columns. runs
  // on mount, when the panel opens/closes, when the card size changes, or when
  // the layout resizes (window resize, app sidebar toggle). animated mode
  // skips this: the grid is fluid there, so any width yields full rows.
  const snapRef = useRef({
    panelWidth,
    sidebarWidth,
    sidebar,
    dispatch,
  })
  snapRef.current = {
    panelWidth,
    sidebarWidth,
    sidebar,
    dispatch,
  }

  const [layoutWidth, setLayoutWidth] = useState(0)

  useEffect(() => {
    const el = pageLayoutRef.current
    if (!el) return

    setLayoutWidth(el.offsetWidth)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setLayoutWidth(Math.round(entry.contentRect.width))
    })

    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (layoutWidth === 0 || animate) return

    const { panelWidth, sidebarWidth, sidebar, dispatch } = snapRef.current
    const currentSidebar = sidebar ? sidebarWidth : 0

    if (panelOpen) {
      const snapped = snapChromeWidth(
        panelWidth,
        currentSidebar,
        MIN_PANEL_WIDTH,
        MAX_PANEL_WIDTH,
      )

      if (Math.abs(snapped - panelWidth) > 1) {
        dispatch(uiSettingsSlice.actions.setDetailPanelWidth(snapped))
      }
    }
  }, [panelOpen, cardWidth, layoutWidth, snapChromeWidth, animate])

  const handlePanelKeyDown = useCallback((e: React.KeyboardEvent) => {
    const returnFocus = () => {
      document.getElementById(BOOK_COLLECTION_ID)?.focus()
    }

    if (e.key === "Escape") {
      e.preventDefault()
      returnFocus()
      return
    }

    if (e.key === "ArrowLeft") {
      const t = e.target as HTMLElement
      const tag = t.tagName
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable ||
        t.getAttribute("role") === "slider"
      ) {
        return
      }
      e.preventDefault()
      returnFocus()
    }
  }, [])

  const coverScopeProps = useCoverScope(shownBook)
  useHotkey("Escape", handleClosePanel, { ignoreInputs: true })

  if (isMobile) {
    return (
      <>
        <PageLayout>
          <PageMain>
            <SkipToBooksLink />
            <PageHeader>
              <SiteHeader breadcrumbs={breadcrumbs} actions={headerActions} />
            </PageHeader>

            {beforeFilters}

            <BookFilters
              className={filtersClassName}
              controller={controller}
              seedLabel={seedLabel}
              sortOptions={sortFieldOptions}
              onSortChange={setSort}
              displayOverrides={gridDisplayFields}
              onDisplayOverridesChange={handleDisplayFieldsChange}
              currentFields={displayFields}
            />

            {afterFilters}

            <PageContent className={contentClassName ?? "p-6"}>
              <BooksView
                books={books}
                isLoading={isLoading}
                isFetchingNextPage={isFetchingNextPage}
                hasNextPage={hasNextPage}
                fetchNextPage={fetchNextPage}
                showMuted={showMuted}
                emptyMessage={emptyMessage}
                emptySubMessage={
                  hasActiveFilters ? emptyFilteredSubMessage : emptySubMessage
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
            </PageContent>
          </PageMain>
        </PageLayout>

        <BookDetailDrawer
          selectedBookUuid={selectedBookUuid}
          selectedBook={selectedBook}
          onClose={handleClosePanel}
          nextBook={goToNext}
          previousBook={goToPrevious}
        />
      </>
    )
  }
  // -- book list layout

  return (
    <BookListPageContext.Provider value={contextValue}>
      <PanelDraggingProvider
        value={driver.dragging || driver.sliding || sidebarResizing}
      >
        <PageLayout ref={pageLayoutRef}>
          {sidebar && (
            <PageSidebar
              width={sidebarWidth}
              onWidthChange={handleSidebarWidthChange}
              // {...(onSidebarWidthChange && {
              //   onWidthChange: onSidebarWidthChange,
              // })}
            >
              {sidebar}
            </PageSidebar>
          )}

          <PageMain>
            <SkipToBooksLink />
            <PageHeader>
              <SiteHeader breadcrumbs={breadcrumbs} actions={headerActions} />
            </PageHeader>

            {/* <BookListLayout
        headerBreadcrumbs={breadcrumbs}
        headerActions={headerActions}
        {...(sidebar
          ? {
              sidebar,
              sidebarWidth,
              onSidebarWidthChange: handleSidebarWidthChange,
            }
          : {})}
        selectedBookUuid={selectedBookUuid}
        selectedBook={selectedBook}
        onClosePanel={handleClosePanel}
        nextBook={goToNext}
        previousBook={goToPrevious}
      > */}

            {beforeFilters}

            <BookFilters
              className={filtersClassName}
              controller={controller}
              seedLabel={seedLabel}
              sortOptions={sortFieldOptions}
              onSortChange={setSort}
              displayOverrides={gridDisplayFields}
              onDisplayOverridesChange={handleDisplayFieldsChange}
              currentFields={displayFields}
            />

            {afterFilters}

            <PageContent className={contentClassName ?? "p-6"}>
              <BooksView
                books={books}
                isLoading={isLoading}
                isFetchingNextPage={isFetchingNextPage}
                hasNextPage={hasNextPage}
                fetchNextPage={fetchNextPage}
                showMuted={showMuted}
                emptyMessage={emptyMessage}
                emptySubMessage={
                  hasActiveFilters ? emptyFilteredSubMessage : emptySubMessage
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
          </PageMain>

          <PagePanel
            open={driver.visible}
            width={panelWidth}
            panelRef={driver.panelRef}
            onResizeStart={driver.startDrag}
            dragging={driver.dragging}
            colors={coverScopeProps}
          >
            {shownUuid && (
              <div
                id={BOOK_DETAIL_PANEL_ID}
                role="region"
                aria-label="Book details"
                tabIndex={-1}
                onKeyDown={handlePanelKeyDown}
                className="flex h-full w-full flex-col outline-none"
              >
                <DynamicBookDetailsContent
                  uuid={shownUuid as UUID}
                  initialBook={shownBook}
                  compact
                  onClose={handleClosePanel}
                  nextBook={goToNext}
                  previousBook={goToPrevious}
                />
              </div>
            )}
          </PagePanel>
        </PageLayout>
      </PanelDraggingProvider>
    </BookListPageContext.Provider>
  )
}

export function BookListPage(props: BookListPageProps) {
  return (
    <BookSelectionProvider>
      <BookListPageInner {...props} />
    </BookSelectionProvider>
  )
}
