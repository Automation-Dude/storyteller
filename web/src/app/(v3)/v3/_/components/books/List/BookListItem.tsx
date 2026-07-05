import { Popover } from "@base-ui/react/popover"
import { Fragment, memo, useCallback } from "react"

import { BookCover } from "@/app/(v3)/v3/_/components/books/BookCover"
import {
  ensureContrast,
  useColorPreferences,
  useCoverColors,
  useIsDarkMode,
} from "@/app/(v3)/v3/_/components/books/BookDetails/sections/useCoverColors"
import { SecondaryText } from "@/app/(v3)/v3/_/components/books/Grid/BookCard"
import { ProcessingIndicator } from "@/app/(v3)/v3/_/components/books/ProcessingIndicator"
import {
  ProgressDisplayBar,
  getReadingProgress,
} from "@/app/(v3)/v3/_/components/books/ProgressDisplayBar"
import { SelectionCheckbox } from "@/app/(v3)/v3/_/components/books/SelectionCheckbox"
import { bookItemDomId } from "@/app/(v3)/v3/_/components/books/keyboard-nav"
import { Skeleton } from "@/app/(v3)/v3/_/components/ui/skeleton"
import { V3Link } from "@/app/(v3)/v3/_/components/v3-link"
import { useIsMobile } from "@/app/(v3)/v3/_/hooks/use-mobile"
import { cn } from "@/cn"
import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { type BookWithRelations } from "@/database/books"
import * as icon from "@/icons"
import { type DisplayField, type SortContext } from "@/sort"

import { ColumnValue, getColumnWidth } from "./BookListColumns"

export const BookListItem = memo(function BookListItem({
  book,
  muted = false,
  selected = false,
  keyboardNav = false,
  active = false,
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
  handle,
}: {
  book: BookWithRelations
  visibleColumns: { field: DisplayField; label: string }[]
  muted?: boolean
  selected?: boolean
  // roving keyboard cursor: container owns the tab stop, this row is the active
  // descendant when `active`.
  keyboardNav?: boolean
  active?: boolean
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
  handle?: Popover.Handle<unknown>
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
        "--color-foreground":
          "color-mix(in srgb, var(--primary) 30%, var(--muted-foreground))",
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
      {...(keyboardNav && {
        id: bookItemDomId(book.uuid),
        "aria-selected": active,
      })}
      className={cn(
        "group hover:bg-primary/10 relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-md py-px pr-3 pl-px transition-colors",
        muted && "opacity-50",
        isBookSelected &&
          !selected &&
          "bg-primary/5 ring-primary/20 ring-1 ring-inset",
        selected && "bg-primary/8 ring-primary/40 ring-1 ring-inset",
        // keyboard cursor reads as a focus ring even though dom focus stays on
        // the container.
        active && "ring-2 ring-blue-500 outline-none ring-inset",
      )}
      onClick={onClick ? handleClick : undefined}
      role={keyboardNav ? "option" : "button"}
      tabIndex={keyboardNav ? -1 : 0}
      onKeyDown={
        keyboardNav
          ? undefined
          : (e) => {
              if ((e.key === "Enter" || e.key === " ") && onClick) {
                onClick(book)
              }
            }
      }
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

          {isSynced && (
            <div
              className="absolute -top-1 -right-1.5 z-30 flex size-3 shrink-0 items-center justify-center rounded-full"
              style={{
                background: showAccent ? cPrimary.solid : "var(--primary)",
              }}
            >
              <IconReadaloud className="size-2.5 text-white" />
            </div>
          )}
        </div>
        {progress !== null && progress > 0 && (
          <div className="absolute right-0 bottom-0 left-0">
            <ProgressDisplayBar
              progress={progress}
              className="h-0.5"
              book={book}
            />
          </div>
        )}
      </div>

      {/* title + secondary (authors or dynamic field) */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <V3Link
            href={`/books/${book.uuid}`}
            prefetch={false}
            className={cn("min-w-0 truncate", !onClick && "big-link")}
            onClick={(e) => {
              if (onClick) e.preventDefault()
            }}
          >
            <span className="group-hover:text-primary font-heading truncate text-[0.9375rem]">
              {book.title}
            </span>
          </V3Link>

          {isProcessing && (
            <ProcessingIndicator book={book} size={16} className="shrink-0" />
          )}
        </div>

        <div
          className={cn(
            "text-muted-foreground flex gap-2 truncate text-xs tabular-nums",
            "group-hover:text-(--color-foreground)",
            (selected || isBookSelected) && "text-(--color-foreground)",
          )}
        >
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
          <p
            className={cn(
              "text-muted-foreground truncate text-xs",
              "group-hover:text-(--color-foreground)",
              (selected || isBookSelected) && "text-(--color-foreground)",
            )}
          >
            {authors.map((a, i) => (
              <Fragment key={a.uuid}>
                <V3Link
                  className="hover:text-primary hover:underline"
                  prefetch={false}
                  href={`/authors?item=${a.uuid}`}
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                >
                  {a.name}
                </V3Link>
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
          book.alignmentSummary?.grade != null
        return (
          <span
            key={field}
            className={cn(
              "text-muted-foreground hidden flex-shrink-0 text-right text-xs tabular-nums @xs/page-content:block",
              "group-hover:text-(--color-foreground)",
              (selected || isBookSelected) && "text-(--color-foreground)!",
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
        {onToggleSelection && (
          <SelectionCheckbox
            uuid={book.uuid}
            checked={isBookSelected}
            isSelecting={isSelecting}
            onToggle={onToggleSelection}
            onSelectRange={onSelectRange}
            // can still access through ellipsis
            className="hidden @xs/page-content:block"
          />
        )}

        {onOpenMenu && handle && (
          <Popover.Trigger
            handle={handle}
            onClick={(e) => {
              e.stopPropagation()
              onOpenMenu(book, e.currentTarget)
            }}
            className={cn(
              "transition-opacity",
              isMenuOpen && "opacity-100",
              !isMobile &&
                !isMenuOpen &&
                "opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
            )}
          >
            <icon.DotsVertical className="size-3.5" />
          </Popover.Trigger>
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
