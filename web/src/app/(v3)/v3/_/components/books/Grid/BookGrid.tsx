"use client"

import { Popover } from "@base-ui/react/popover"
import { useCallback, useMemo } from "react"

import { Button } from "@v3/_/components/ui/button"
import {
  FilterableMenuContent,
  FilterableMenuItem,
  FilterableMenuSeparator,
} from "@v3/_/components/ui/filterable-menu"
import { useUserPreferences } from "@v3/_/components/user-preferences-provider"
import { useGridNavigation } from "@v3/_/hooks/use-grid-navigation"
import { useLayoutAnimations } from "@v3/_/hooks/use-layout-animations"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { cn } from "@v3/_/lib/utils"

import { ActionEntryList } from "@/app/(v3)/v3/_/components/books/ActionMenu/BookActionMenuItems"
import { useBookActionMenu } from "@/app/(v3)/v3/_/components/books/ActionMenu/useBookActionMenu"
import { CoverLoadProvider } from "@/app/(v3)/v3/_/components/books/Cover"
import { BookCard } from "@/app/(v3)/v3/_/components/books/Grid/BookCard"
import { BookCardSkeleton } from "@/app/(v3)/v3/_/components/books/Grid/BookCardSkeleton"
import { SelectionBullet } from "@/app/(v3)/v3/_/components/books/SelectionCheckbox"
import {
  BOOK_COLLECTION_ID,
  BOOK_DETAIL_PANEL_ID,
  type BookNavModel,
  bookItemDomId,
} from "@/app/(v3)/v3/_/components/books/keyboard-nav"
import { usePanelDragging } from "@/app/(v3)/v3/_/components/books/panel-resize-context"
import {
  useCommon,
  useTranslation,
} from "@/app/(v3)/v3/_/hooks/use-translation"
import {
  type VirtualGridGeometry,
  useVirtualGrid,
} from "@/app/(v3)/v3/_/hooks/use-virtual-grid"
import { type BookWithRelations } from "@/database/books"
import { type GridCardSize } from "@/database/userPreferencesTypes"
import * as icon from "@/icons"
import { type DisplayField, type SortContext } from "@/sort"
import { Card } from "@/app/(v3)/v3/(app)/test/page"
import { useQueryState } from "nuqs"

type BookGridProps = {
  books: BookWithRelations[]
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  fetchNextPage: () => void
  showMuted: boolean
  emptyMessage?: string | undefined
  emptySubMessage?: string | undefined
  onClearFilters?: () => void
  hasActiveFilters?: boolean
  selectedBookUuid?: string | null
  onBookClick?: (
    book: BookWithRelations,
    isSelecting: boolean,
    isBookSelected: boolean,
  ) => void
  displayFields?: DisplayField[]
  displayContext?: SortContext
  // temporary: which keyboard-open model the grid uses (see LibraryPage toggle)
  navModel?: BookNavModel
}

export const GRID_CARD_WIDTHS: Record<GridCardSize, number> = {
  smallest: 130,
  small: 155,
  medium: 180,
  large: 220,
  largest: 270,
}
export const BOOK_GRID_GAP = 16 // gap-4
const COVER_ASPECT = 16 / 13 // cover box is aspect-13/16 -> height = width * 16/13
const MOBILE_COLUMNS = 2

// meta height must be known up front (this virtualizer is uniform-cell and
// doesn't measure rows). estimate it from the fields the card renders: a
// 2-line title, an authors line when shown, plus one line per extra field.
function metaHeightFor(fields: DisplayField[]): number {
  const TOP = 8 // mt-2
  const TITLE = 38 // 2 lines, leading-tight
  const LINE = 18 // one text-xs line + gap-0.5
  const extra = fields.filter((f) => f !== "authors" && f !== "title").length
  const authorsLine = fields.includes("authors") ? 1 : 0
  return TOP + TITLE + (extra + authorsLine) * LINE
}

export function BookGrid({
  books: rawBooks,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  showMuted,
  onClearFilters,
  hasActiveFilters,
  selectedBookUuid,
  onBookClick,
  displayFields,
  displayContext,
  navModel = "commit",
  ...props
}: BookGridProps) {
  const books = rawBooks

  const t = useTranslation("BookList")
  const menu = useBookActionMenu(books)

  const emptyMessage = props.emptyMessage ?? t("emptyState")
  const emptySubMessage = props.emptySubMessage ?? t("emptyStateSub")

  const isMobile = useIsMobile()
  const { gridCardSize } = useUserPreferences()
  const cardWidth = GRID_CARD_WIDTHS[gridCardSize]

  // animated mode: fluid 1fr cards + FLIP re-wraps. fallback (reduced motion or
  // the preference off): fluid cards that reflow instantly (no FLIP).
  const animate = useLayoutAnimations() && !isMobile

  const metaHeight = useMemo(
    () => metaHeightFor(displayFields ?? ["authors"]),
    [displayFields],
  )

  const geometry = useMemo<VirtualGridGeometry>(
    () => ({
      minColumnWidth: cardWidth,
      gapX: BOOK_GRID_GAP,
      gapY: BOOK_GRID_GAP,
      padX: 0,
      padY: 0,
      rowHeightForColumnWidth: (w) => w * COVER_ASPECT + metaHeight,
      ...(isMobile ? { fixedColumns: MOBILE_COLUMNS } : {}),
    }),
    [cardWidth, metaHeight, isMobile],
  )

  // pin the selected card across reflows (panel open, resize, card-size change)
  const anchorIndex = useMemo(() => {
    if (!selectedBookUuid) return null
    const i = books.findIndex((b) => b.uuid === selectedBookUuid)
    return i >= 0 ? i : null
  }, [books, selectedBookUuid])

  // manual panel drag wants immediate column reflow; animated width changes
  // (panel open/close, sidebar toggle) keep the settle-then-reflow.
  const panelDragging = usePanelDragging()

  const grid = useVirtualGrid({
    itemCount: books.length,
    geometry,
    anchorIndex,
    animate,
    flipDuration: 500,
    hasNextPage,
    isFetchingNextPage,
    onFetchNextPage: fetchNextPage,
    deferCoverLoads: true,
    overscanRows: 4,
    liveResize: panelDragging,
  })

  // keyboard navigation: focus stays on the grid container, arrows move a cursor
  // (2d via the live column count), the active card is surfaced via
  // aria-activedescendant. only wired when the grid is interactive.
  const navEnabled = !!onBookClick

  const [, setSelectedBookId] = useQueryState("book")

  const openBookAt = useCallback(
    (index: number) => {
      const book = books[index]
      void setSelectedBookId(book?.uuid ?? null)
      // if (book) onBookClick?.(book)
    },
    [books, onBookClick],
  )

  const focusDetailPanel = useCallback(() => {
    requestAnimationFrame(() => {
      document.getElementById(BOOK_DETAIL_PANEL_ID)?.focus()
    })
  }, [])

  const scrollToIndex = grid.scrollToIndex
  const nav = useGridNavigation({
    itemCount: books.length,
    columns: grid.metrics.cols || 1,
    enabled: navEnabled,
    getItemId: (index) => {
      const book = books[index]
      return book ? bookItemDomId(book.uuid) : undefined
    },
    scrollToIndex,
    initialIndex: () => {
      const i = books.findIndex((b) => b.uuid === selectedBookUuid)
      return i >= 0 ? i : 0
    },
    // preview model opens the book as the cursor moves; commit model only
    // highlights until Enter.
    onActiveChange:
      navModel === "preview"
        ? (index) => {
            openBookAt(index)
          }
        : undefined,
    onActivate: (index) => {
      openBookAt(index)
      focusDetailPanel()
    },
  })

  const activeUuid =
    nav.activeIndex !== null ? books[nav.activeIndex]?.uuid ?? null : null

  const c = useCommon()
  const tActions = useTranslation("BookActions")

  if (isLoading) {
    return (
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: isMobile
            ? "minmax(0, 1fr)"
            : `repeat(auto-fill, ${cardWidth}px)`,
        }}
      >
        {Array.from({ length: 40 }).map((_, i) => (
          <BookCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[50vh] flex-col items-center justify-center gap-2">
        <icon.Search className="h-12 w-12 opacity-40" />
        <p className="text-lg font-medium">{emptyMessage}</p>
        {emptySubMessage && <p className="text-sm">{emptySubMessage}</p>}

        {hasActiveFilters && onClearFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="mt-2"
          >
            Clear Filters
          </Button>
        )}
      </div>
    )
  }

  const visible = books.slice(grid.startIndex, grid.endIndex)

  return (
    <>
      <div
        ref={grid.sizerRef}
        id={BOOK_COLLECTION_ID}
        aria-label="Books"
        {...(navEnabled ? nav.containerProps : {})}
        className={cn(
          "relative w-full transition-opacity duration-200 outline-none",
          showMuted && "opacity-60",
        )}
        style={grid.sizerStyle}
      >
        <CoverLoadProvider value={grid.imagesActive}>
          <div ref={grid.gridRef} style={grid.gridStyle}>
            {visible.map((book, i) => {
              const index = grid.startIndex + i
              return (
                <BookCard
                  key={book.uuid}
                  index={index}
                  book={book}
                  coverWidth={cardWidth}
                  muted={showMuted}
                  keyboardNav={navEnabled}
                  active={navEnabled && book.uuid === activeUuid}
                  selected={book.uuid === selectedBookUuid}
                  isSelecting={menu.isSelecting}
                  isBookSelected={
                    menu.selection?.isSelected(book.uuid) ?? false
                  }
                  onToggleSelection={menu.toggleSelection}
                  onOpenMenu={menu.handleOpenMenu}
                  onClick={onBookClick}
                  handle={menu.handle}
                  displayFields={displayFields}
                  displayContext={displayContext}
                />
              )
            })}
          </div>
        </CoverLoadProvider>
      </div>

      {isFetchingNextPage && (
        <div className="text-muted-foreground mt-4 flex items-center justify-center gap-2">
          <icon.LoaderIOSish className="h-5 w-5 animate-spin" />
          <span>Loading more...</span>
        </div>
      )}

      <Popover.Root handle={menu.handle}>
        <FilterableMenuContent
          searchable
          searchPlaceholder={tActions.plain("search")}
          align="end"
          className="pointer-events-auto z-100 min-w-44"
          onClose={() => {
            menu.handle.close()
          }}
        >
          {menu.toggleSelection && menu.menuBook && (
            <>
              <FilterableMenuItem
                icon={<SelectionBullet selected={menu.menuBookIsSelected} />}
                textValue={
                  menu.menuBookIsSelected
                    ? c.plain("actions.deselect")
                    : c.plain("actions.select")
                }
                onSelect={() => {
                  menu.toggleSelection?.(menu.menuBook?.uuid ?? "")
                }}
              >
                {menu.menuBookIsSelected
                  ? c("actions.deselect")
                  : c("actions.select")}
              </FilterableMenuItem>
              <FilterableMenuSeparator />
            </>
          )}

          <ActionEntryList entries={menu.menuEntries} />
        </FilterableMenuContent>
      </Popover.Root>

      {menu.menuDialogs}
    </>
  )
}
