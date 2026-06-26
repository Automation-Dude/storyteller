"use client"

import {
  IconChevronDown,
  IconChevronUp,
  IconDotsVertical,
  IconLoader,
  IconSearch,
} from "@tabler/icons-react"
import Link from "next/link"
import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { type BookWithRelations } from "@/database/books"
import {
  DISPLAY_FIELD_LABELS,
  type DisplayField,
  type SortContext,
  type SortDirection,
  type SortField,
} from "@/sort"

import { Button } from "@v3/_/components/ui/button"
import { Checkbox } from "@v3/_/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@v3/_/components/ui/dropdown-menu"
import { Skeleton } from "@v3/_/components/ui/skeleton"
import { useOptionalBookSelection } from "@v3/_/hooks/use-book-selection"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { useBookActionItems } from "./BookActionMenuItems"
import { secondaryText } from "./BookCard"
import { BookCover } from "./BookCover"
import {
  ensureContrast,
  useColorPreferences,
  useCoverColors,
  useIsDarkMode,
} from "./BookDetails/sections/useCoverColors"
import { ProgressDisplayBar, getReadingProgress } from "./ProgressDisplayBar"

type BookListProps = {
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
  onBookClick?: (book: BookWithRelations) => void
  displayField?: DisplayField
  displayContext?: SortContext
  visibleColumns?: DisplayField[]
  sortField?: SortField
  sortDirection?: SortDirection
  onSortChange?: (field: SortField, direction: SortDirection) => void
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`

  const units = ["KB", "MB", "GB"]
  let size = bytes / 1024
  let i = 0

  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }

  return `${size.toFixed(1)} ${units[i]}`
}

export function columnValue(
  book: BookWithRelations,
  field: DisplayField,
): string {
  switch (field) {
    case "authors":
      return book.authors.map((a) => a.name).join(", ") || "\u2014"
    case "userRating":
      return book.rating?.rating != null
        ? `\u2605 ${book.rating.rating.toFixed(1)}`
        : "\u2014"
    case "publicationDate":
      return book.publicationDate ? book.publicationDate.slice(0, 4) : "\u2014"
    case "createdAt":
      return new Date(book.createdAt).toLocaleDateString()
    case "updatedAt":
      return new Date(book.updatedAt).toLocaleDateString()
    case "pageCount": {
      const p = book.ebook?.pageCount ?? book.pageCount
      return p != null ? `${p}` : "\u2014"
    }
    case "duration": {
      const d = book.audiobook?.duration ?? book.duration
      return d != null ? formatDuration(d) : "\u2014"
    }
    case "fileSize": {
      const f = book.ebook?.fileSize ?? book.audiobook?.fileSize ?? null
      return f != null ? formatFileSize(f) : "\u2014"
    }
    case "language":
      return book.language ?? "\u2014"
    case "title":
      return book.title
    case "seriesPosition": {
      const s = book.series[0]
      if (!s || s.position == null) return "\u2014"
      return `#${s.position}`
    }
  }
}

const DEFAULT_COLUMNS: DisplayField[] = ["authors", "duration", "pageCount"]

const BookListItem = memo(function BookListItem({
  book,
  muted = false,
  selected = false,
  isSelecting = false,
  isBookSelected = false,
  onToggleSelection,
  onSelectRange,
  onOpenMenu,
  isMenuOpen = false,
  onClick,
  displayField = "authors",
  displayContext,
  visibleColumns = DEFAULT_COLUMNS,
}: {
  book: BookWithRelations
  muted?: boolean
  selected?: boolean
  isSelecting?: boolean
  isBookSelected?: boolean
  onToggleSelection?: (uuid: string) => void
  onSelectRange?: (uuid: string) => void
  onOpenMenu?: (book: BookWithRelations, anchor: HTMLElement) => void
  isMenuOpen?: boolean
  onClick?: (book: BookWithRelations) => void
  displayField?: DisplayField
  displayContext?: SortContext
  visibleColumns?: DisplayField[]
}) {
  const isMobile = useIsMobile()

  const isSynced =
    book.readaloud !== null && book.readaloud.status === "ALIGNED"
  const isProcessing =
    book.readaloud?.status === "PROCESSING" ||
    book.readaloud?.status === "QUEUED"

  const progress = getReadingProgress(book)
  const authors = book.authors

  // if the sort field is already visible as a column, keep showing authors
  // in the secondary line. otherwise replace authors with the sort field.
  const sortFieldIsVisibleColumn =
    displayField === "authors" || visibleColumns.includes(displayField)

  const effectiveSecondary = sortFieldIsVisibleColumn
    ? null
    : secondaryText(book, displayField, displayContext)

  const showAuthors = effectiveSecondary === null

  const showCheckbox = !!onToggleSelection

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (e.shiftKey && onSelectRange) {
      onSelectRange(book.uuid)
      return
    }

    onToggleSelection?.(book.uuid)
  }

  const { primary, accent } = useCoverColors(book)
  const { showTint, showAccent, tint } = useColorPreferences()
  const isDark = useIsDarkMode()

  const cPrimary = ensureContrast(primary, isDark)
  const cAccent = ensureContrast(accent, isDark)
  const style = showAccent
    ? ({
        "--primary": cPrimary.solid,
        "--primary-foreground": cPrimary.onColor,
        "--primary-accent": cAccent.solid,
        "--primary-accent-foreground": cAccent.onColor,
      } as React.CSSProperties)
    : undefined

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()

      if (e.shiftKey && onSelectRange) {
        e.preventDefault()
        window.getSelection()?.empty()
        onSelectRange(book.uuid)
        return
      }

      onClick?.(book)
    },
    [book, onClick, onSelectRange],
  )

  // columns that aren't title or authors get dedicated cells
  const extraColumns = visibleColumns.filter(
    (f) => f !== "title" && f !== "authors",
  )

  return (
    <div
      data-book-uuid={book.uuid}
      className={cn(
        "group hover:bg-accent relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors",
        muted && "opacity-50",
        isBookSelected && "bg-accent ring-primary ring-1 ring-inset",
        selected &&
          !isBookSelected &&
          "bg-primary/5 ring-primary/40 ring-1 ring-inset",
      )}
      onClick={onClick ? handleClick : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onClick) {
          onClick(book)
        }
      }}
      style={style}
    >
      {/* cover */}
      <div
        className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded"
        style={showTint ? { background: tint(primary, 0.36) } : undefined}
      >
        <div className="relative flex h-12 w-10 items-center justify-center">
          <BookCover
            book={book}
            width={50}
            disableHover
            onLoadingChange={() => {}}
          />
        </div>
        {progress !== null && progress > 0 && (
          <div className="absolute right-0 bottom-0 left-0">
            <ProgressDisplayBar progress={progress} book={book} />
          </div>
        )}
      </div>

      {/* title + secondary (authors or dynamic field) */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/v3/books/${book.uuid}`}
            prefetch={false}
            className={cn("min-w-0 truncate", !onClick && "big-link")}
            onClick={(e) => {
              if (onClick) e.preventDefault()
            }}
          >
            <span className="group-hover:text-primary font-heading truncate text-[0.9375rem]">
              {book.title}
            </span>
          </Link>

          {isSynced && (
            <div
              className="flex size-4 shrink-0 items-center justify-center rounded-full"
              style={{
                background: showAccent ? cPrimary.solid : "var(--primary)",
              }}
            >
              <IconReadaloud className="size-2.5 text-white" />
            </div>
          )}

          {isProcessing && (
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" />
          )}
        </div>

        {!showAuthors && (
          <p className="text-muted-foreground/80 truncate text-xs tabular-nums">
            {effectiveSecondary}
          </p>
        )}

        {showAuthors && authors.length > 0 && (
          <p className="text-muted-foreground/80 truncate text-xs">
            {authors.map((a, i) => (
              <Fragment key={a.uuid}>
                <Link
                  className="hover:text-primary hover:underline"
                  prefetch={false}
                  href={`/v3/authors?item=${a.uuid}`}
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                >
                  {a.name}
                </Link>
                {i < authors.length - 1 && ", "}
              </Fragment>
            ))}
          </p>
        )}
      </div>

      {/* column values */}
      {extraColumns.map((field) => (
        <span
          key={field}
          className="text-muted-foreground hidden w-20 flex-shrink-0 text-right text-xs tabular-nums sm:block"
        >
          {columnValue(book, field)}
        </span>
      ))}

      {/* actions: checkbox + ellipsis */}
      <div className="flex shrink-0 items-center gap-1">
        {showCheckbox && (
          <div
            className={cn(
              "transition-opacity",
              !isBookSelected &&
                !isSelecting &&
                "opacity-0 group-hover:opacity-100",
            )}
            onClick={handleCheckboxClick}
            role="button"
            tabIndex={0}
          >
            <Checkbox
              onClick={(e) => {
                e.stopPropagation()
              }}
              checked={isBookSelected}
              tabIndex={-1}
              className="hover:border-primary h-5 w-5 cursor-pointer rounded-full border-2 shadow-sm transition-colors data-checked:border-2"
            />
          </div>
        )}

        {onOpenMenu && (
          <div
            className={cn(
              "transition-opacity",
              isMenuOpen && "opacity-100",
              !isMobile &&
                !isMenuOpen &&
                "opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
            )}
          >
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded-md transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onOpenMenu(book, e.currentTarget)
              }}
            >
              <IconDotsVertical className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

export function BookListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <Skeleton className="h-14 w-10 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}

function ColumnHeader({
  field,
  sortField,
  sortDirection,
  onSortChange,
}: {
  field: DisplayField
  sortField?: SortField
  sortDirection?: SortDirection
  onSortChange?: (field: SortField, direction: SortDirection) => void
}) {
  if (field === "authors" || field === "title") return null

  const isSortable = !!onSortChange
  const isActive = sortField === field
  const label = DISPLAY_FIELD_LABELS[field]

  const handleClick = () => {
    if (!onSortChange) return

    const sortableField = field as SortField
    if (isActive) {
      onSortChange(sortableField, sortDirection === "asc" ? "desc" : "asc")
    } else {
      onSortChange(sortableField, "desc")
    }
  }

  return (
    <button
      type="button"
      className={cn(
        "text-muted-foreground hidden w-20 shrink-0 items-center justify-end gap-0.5 text-right text-[11px] font-medium tracking-wider uppercase sm:flex",
        isSortable && "hover:text-foreground cursor-pointer",
        isActive && "text-foreground",
      )}
      onClick={isSortable ? handleClick : undefined}
      disabled={!isSortable}
    >
      <span className="truncate">{label}</span>

      {isActive &&
        (sortDirection === "asc" ? (
          <IconChevronUp className="size-3 shrink-0" />
        ) : (
          <IconChevronDown className="size-3 shrink-0" />
        ))}
    </button>
  )
}

export function BookList({
  books,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  showMuted,
  emptyMessage = "No books found",
  emptySubMessage,
  onClearFilters,
  hasActiveFilters,
  selectedBookUuid,
  onBookClick,
  displayField = "authors",
  displayContext,
  visibleColumns = DEFAULT_COLUMNS,
  sortField,
  sortDirection,
  onSortChange,
}: BookListProps) {
  const selection = useOptionalBookSelection()
  const isSelecting = (selection?.selectedBooks.size ?? 0) > 0
  const toggleSelection = selection?.toggleSelection
  const t = useTranslation("BookActions")

  const orderedUuids = useMemo(() => books.map((b) => b.uuid), [books])

  const handleSelectRange = useCallback(
    (uuid: string) => {
      selection?.selectRange(uuid, orderedUuids)
    },
    [selection, orderedUuids],
  )

  // shared card menu: one instance, positioned at whichever row opened it
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuBook, setMenuBook] = useState<BookWithRelations | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const handleOpenMenu = useCallback(
    (book: BookWithRelations, anchor: HTMLElement) => {
      setMenuBook(book)
      setMenuAnchor(anchor)
      setMenuOpen(true)
    },
    [],
  )

  const { items: menuItems, dialogs: menuDialogs } = useBookActionItems({
    books: menuBook ? [menuBook] : [],
    mode: "single",
  })

  const menuBookIsSelected = menuBook
    ? selection?.isSelected(menuBook.uuid) ?? false
    : false

  const loadMoreRef = useRef<HTMLDivElement>(null)

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries
      if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  )

  useEffect(() => {
    const element = loadMoreRef.current
    if (!element) return

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "200px",
      threshold: 0,
    })

    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [handleObserver])

  // the column headers that get their own column (not title/authors)
  const extraColumns = visibleColumns.filter(
    (f) => f !== "title" && f !== "authors",
  )

  if (isLoading) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: 12 }).map((_, i) => (
          <BookListItemSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[50vh] flex-col items-center justify-center gap-2">
        <IconSearch className="h-12 w-12 opacity-40" />
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

  return (
    <>
      {/* column header row */}
      {extraColumns.length > 0 && (
        <div className="border-border flex items-center gap-3 border-b px-3 pb-1.5">
          {/* spacer for cover + title */}
          <div className="h-px w-10 shrink-0" />
          <div className="min-w-0 flex-1" />

          {extraColumns.map((field) => (
            <ColumnHeader
              key={field}
              field={field}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
            />
          ))}

          {/* spacer matching right-side actions width */}
          <div className="w-[3.25rem] shrink-0" />
        </div>
      )}

      <div
        className={cn(
          "animate-in fade-in-0 flex flex-col transition-opacity duration-300",
          showMuted && "opacity-60",
        )}
      >
        {books.map((book) => (
          <BookListItem
            key={book.uuid}
            book={book}
            muted={showMuted}
            selected={book.uuid === selectedBookUuid}
            isSelecting={isSelecting}
            isBookSelected={selection?.isSelected(book.uuid) ?? false}
            onToggleSelection={toggleSelection}
            onSelectRange={handleSelectRange}
            onOpenMenu={handleOpenMenu}
            isMenuOpen={menuOpen && menuBook?.uuid === book.uuid}
            onClick={onBookClick}
            displayField={displayField}
            displayContext={displayContext}
            visibleColumns={visibleColumns}
          />
        ))}
      </div>

      <div ref={loadMoreRef} className="mt-8 flex justify-center">
        {isFetchingNextPage && (
          <div className="text-muted-foreground flex items-center gap-2">
            <IconLoader className="h-5 w-5 animate-spin" />
            <span>Loading more...</span>
          </div>
        )}
      </div>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuContent
          align="end"
          className="pointer-events-auto z-100 min-w-44"
          anchor={menuAnchor}
        >
          {toggleSelection && menuBook && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  toggleSelection(menuBook.uuid)
                }}
              >
                {menuBookIsSelected ? t("deselect") : t("select")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {menuItems}
        </DropdownMenuContent>
      </DropdownMenu>

      {menuDialogs}
    </>
  )
}
