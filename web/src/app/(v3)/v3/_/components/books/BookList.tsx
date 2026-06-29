"use client"

import {
  IconChevronDown,
  IconChevronUp,
  IconDotsVertical,
  IconLoader,
  IconSearch,
} from "@tabler/icons-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import Link from "next/link"
import { useFormatter } from "next-intl"
import { Fragment, memo, useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@v3/_/components/ui/button"
import { Checkbox } from "@v3/_/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@v3/_/components/ui/dropdown-menu"
import { Skeleton } from "@v3/_/components/ui/skeleton"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import {
  DEFAULT_DATE_OPTIONS,
  useFormatList,
  useFormatRelativeTime,
} from "@/app/(v3)/v3/_/lib/date"
import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { type BookWithRelations } from "@/database/books"
import {
  type DisplayField,
  type SortContext,
  type SortDirection,
  type SortField,
} from "@/sort"

import { SecondaryText } from "./BookCard"
import { BookCover } from "./BookCover"
import {
  ensureContrast,
  useColorPreferences,
  useCoverColors,
  useIsDarkMode,
} from "./BookDetails/sections/useCoverColors"
import { ColumnSelector } from "./ColumnSelector"
import { ProgressDisplayBar, getReadingProgress } from "./ProgressDisplayBar"
import { GradePill } from "./grade-pill"
import { findScrollParent, useBookActionMenu } from "./useBookActionMenu"

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
  // click on a specific column cell (e.g. the alignment grade) instead of the
  // row. when omitted, those cells fall through to the row click.
  onColumnClick?: (book: BookWithRelations, field: DisplayField) => void
  displayFields?: DisplayField[]
  displayContext?: SortContext
  visibleColumns?: DisplayField[]
  onVisibleColumnsChange?: (fields: DisplayField[]) => void
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

export function ColumnValue({
  book,
  field,
}: {
  book: BookWithRelations
  field: DisplayField
}) {
  const formatRelativeTime = useFormatRelativeTime()
  // const formatDate = useFormatDate()
  const formatList = useFormatList()
  const { dateTime } = useFormatter()

  switch (field) {
    case "authors":
      return formatList(book.authors.map((a) => a.name)) || "\u2014"
    case "userRating":
      return book.rating?.rating != null
        ? `\u2605 ${book.rating.rating.toFixed(1)}`
        : "\u2014"
    case "publicationDate":
      if (!book.publicationDate) return "\u2014"
      return dateTime(new Date(book.publicationDate), {
        year: "numeric",
      })
    case "createdAt":
      return dateTime(new Date(book.createdAt), {
        dateStyle: "medium",
      })
    case "updatedAt":
      return (
        <time
          dateTime={book.updatedAt}
          title={dateTime(new Date(book.updatedAt), DEFAULT_DATE_OPTIONS)}
        >
          {formatRelativeTime(book.updatedAt, {
            now: new Date(),
            style: "narrow",
          })}
        </time>
      )
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
    case "alignmentScore":
      return book.alignmentScore != null
        ? `${Math.round(book.alignmentScore)}%`
        : "\u2014"
    case "alignmentGrade":
      return book.alignmentGrade ? (
        <GradePill grade={book.alignmentGrade} />
      ) : (
        "\u2014"
      )
    case "alignmentMissingSentences":
      return book.alignmentMissingSentences != null
        ? `${book.alignmentMissingSentences}`
        : "\u2014"
    case "alignmentMutedChapters":
      return book.alignmentMutedChapters != null
        ? `${book.alignmentMutedChapters}`
        : "\u2014"
    case "title":
      return book.title
    case "alignedAt":
      return book.alignedAt
        ? dateTime(new Date(book.alignedAt), { dateStyle: "medium" })
        : "\u2014"
    case "lastRead":
      return book.position?.updatedAt ? (
        <time
          dateTime={book.position.updatedAt}
          title={dateTime(
            new Date(book.position.updatedAt),
            DEFAULT_DATE_OPTIONS,
          )}
        >
          {formatRelativeTime(book.position.updatedAt, {
            now: new Date(),
            style: "narrow",
          })}
        </time>
      ) : (
        "\u2014"
      )
    case "seriesPosition": {
      const s = book.series[0]
      if (!s || s.position == null) return "\u2014"
      return `#${s.position}`
    }
  }
}

const DEFAULT_COLUMNS: DisplayField[] = ["authors", "duration", "pageCount"]

const ESTIMATED_ROW_HEIGHT = 58

const columnWidths: Record<DisplayField, number> = {
  authors: 80,
  duration: 40,
  pageCount: 40,
  fileSize: 40,
  language: 50,
  publicationDate: 50,
  createdAt: 80,
  updatedAt: 100,
  alignedAt: 80,
  lastRead: 100,
  seriesPosition: 30,
  title: 100,
  userRating: 50,
  alignmentScore: 50,
  alignmentGrade: 40,
  alignmentMissingSentences: 60,
  alignmentMutedChapters: 60,
}

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
  onColumnClick,
  displayFields = ["authors"],
  displayContext,
  visibleColumns,
}: {
  book: BookWithRelations
  visibleColumns: { field: DisplayField; label: string }[]
  muted?: boolean
  selected?: boolean
  isSelecting?: boolean
  isBookSelected?: boolean
  onToggleSelection?: (uuid: string) => void
  onSelectRange?: (uuid: string) => void
  onOpenMenu?: (book: BookWithRelations, anchor: HTMLElement) => void
  isMenuOpen?: boolean
  onClick?: (book: BookWithRelations) => void
  onColumnClick?: (book: BookWithRelations, field: DisplayField) => void
  displayFields?: DisplayField[]
  displayContext?: SortContext
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
  const _sortFieldIsVisibleColumn =
    displayFields.includes("authors") ||
    visibleColumns.some((c) => displayFields.includes(c.field))

  // const showAuthors = effectiveSecondary === null

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
    (c) => c.field !== "title" && c.field !== "authors",
  )

  return (
    <div
      data-book-uuid={book.uuid}
      className={cn(
        "group hover:bg-accent relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-md py-px pr-3 pl-px transition-colors",
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
        className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-md"
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

        <div className="text-muted-foreground/80 flex gap-2 truncate text-xs tabular-nums">
          {displayFields.map((field) => (
            <SecondaryText
              key={field}
              book={book}
              field={field}
              ctx={displayContext}
            />
          ))}
        </div>

        {displayFields.includes("authors") && authors.length > 0 && (
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
      {extraColumns.map(({ field, label }) => {
        // the alignment columns open the report panel rather than the row's
        // details, when a column-click handler is provided.
        const isClickable =
          !!onColumnClick &&
          (field === "alignmentGrade" || field === "alignmentScore") &&
          book.alignmentGrade != null
        return (
          <span
            key={field}
            className={cn(
              "text-muted-foreground hidden flex-shrink-0 text-right text-xs tabular-nums sm:block",
              isClickable && "hover:text-foreground cursor-pointer",
            )}
            style={{
              width: getColumnWidth(field, label),
            }}
            onClick={
              isClickable
                ? (e) => {
                    e.stopPropagation()
                    onColumnClick(book, field)
                  }
                : undefined
            }
          >
            <ColumnValue book={book} field={field} />
          </span>
        )
      })}

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
              id={book.title + book.uuid}
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
    <div className="flex h-14 items-center gap-3 rounded-md py-px pr-3 pl-px">
      <Skeleton className="h-14 w-14 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}

function getColumnWidth(field: DisplayField, label: string) {
  // + 2 is for the chevron
  // could also use retext to measure the actual width of the label
  return `max(${columnWidths[field]}px, ${label.length + 2}ch)`
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
  const t = useTranslation("Common.fields")

  if (field === "authors" || field === "title") return null

  const isSortable = !!onSortChange
  const isActive = sortField === field
  const label = t(`short.${field}`)

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
        "text-muted-foreground hidden h-full min-w-fit shrink-0 items-center justify-end gap-0.5 text-right text-[11px] font-medium tracking-wider uppercase sm:flex",
        isSortable && "hover:text-foreground cursor-pointer",
        isActive && "text-foreground",
      )}
      style={{ width: getColumnWidth(field, label) }}
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
  onColumnClick,
  displayFields = ["authors"],
  displayContext,
  visibleColumns = DEFAULT_COLUMNS,
  onVisibleColumnsChange,
  sortField,
  sortDirection,
  onSortChange,
}: BookListProps) {
  const menu = useBookActionMenu(books)

  // the column headers that get their own column (not title/authors)
  const extraColumns = visibleColumns.filter(
    (f) => f !== "title" && f !== "authors",
  )

  // --- virtualization ---

  const observerRef = useRef<ResizeObserver | null>(null)
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()

    if (!node) {
      observerRef.current = null
      return
    }

    setScrollElement(findScrollParent(node))

    const observer = new ResizeObserver(() => {
      // we only need the scroll parent, no width tracking for a list
    })
    observer.observe(node)
    observerRef.current = observer
  }, [])

  const rowVirtualizer = useVirtualizer({
    count: books.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
    measureElement:
      typeof window !== "undefined"
        ? (element) => element.getBoundingClientRect().height
        : undefined,
    useFlushSync: false,
    directDomUpdates: true,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()

  const lastVirtualRowIndex = virtualRows.at(-1)?.index

  const t = useTranslation("Common.fields")

  useEffect(() => {
    if (lastVirtualRowIndex === undefined) return

    if (
      lastVirtualRowIndex >= books.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage()
    }
  }, [
    lastVirtualRowIndex,
    books.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ])

  if (!isLoading && books.length === 0) {
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

  const translatedVisibleColumns = visibleColumns.map((field) => {
    return {
      field,
      label: t(`short.${field}`),
    }
  })

  return (
    <>
      {/* column header row */}
      <div className="border-border bg-background sticky -top-4 z-10 -mx-4 flex items-center gap-3 border-b px-3 pb-1.5">
        {/* spacer for cover + title */}
        <div className="h-px w-10 shrink-0" />
        <div className="min-w-0 flex-1" />

        {extraColumns.length > 0 &&
          extraColumns.map((field) => (
            <ColumnHeader
              key={field}
              field={field}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
            />
          ))}
        <div className="flex w-[4rem] shrink-0 items-center justify-center">
          {onVisibleColumnsChange && (
            <ColumnSelector
              visibleFields={visibleColumns}
              onChange={onVisibleColumnsChange}
              className="h-4"
            />
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-px py-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <BookListItemSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div
          ref={containerRef}
          className={cn(
            "animate-in fade-in-0 relative w-full py-4 transition-opacity duration-300",
            showMuted && "opacity-60",
          )}
          style={{ height: rowVirtualizer.getTotalSize() }}
        >
          {virtualRows.map((virtualRow) => {
            const book = books[virtualRow.index]
            if (!book) return null

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="absolute top-1 left-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <BookListItem
                  book={book}
                  muted={showMuted}
                  selected={book.uuid === selectedBookUuid}
                  isSelecting={menu.isSelecting}
                  isBookSelected={
                    menu.selection?.isSelected(book.uuid) ?? false
                  }
                  onToggleSelection={menu.toggleSelection}
                  onSelectRange={menu.handleSelectRange}
                  onOpenMenu={menu.handleOpenMenu}
                  isMenuOpen={
                    menu.menuOpen && menu.menuBook?.uuid === book.uuid
                  }
                  onClick={onBookClick}
                  onColumnClick={onColumnClick}
                  displayFields={displayFields}
                  displayContext={displayContext}
                  visibleColumns={translatedVisibleColumns}
                />
              </div>
            )
          })}
        </div>
      )}

      {isFetchingNextPage && (
        <div className="text-muted-foreground mt-4 flex items-center justify-center gap-2">
          <IconLoader className="h-5 w-5 animate-spin" />
          <span>Loading more...</span>
        </div>
      )}

      <DropdownMenu
        open={menu.menuOpen}
        onOpenChange={menu.handleMenuOpenChange}
      >
        <DropdownMenuContent
          align="end"
          className="pointer-events-auto z-100 min-w-44"
          anchor={menu.menuAnchor}
        >
          {menu.toggleSelection && menu.menuBook && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  menu.toggleSelection?.(menu.menuBook?.uuid ?? "")
                }}
              >
                {menu.menuBookIsSelected
                  ? menu.c("actions.deselect")
                  : menu.c("actions.select")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {menu.menuItems}
        </DropdownMenuContent>
      </DropdownMenu>

      {menu.menuDialogs}
    </>
  )
}
