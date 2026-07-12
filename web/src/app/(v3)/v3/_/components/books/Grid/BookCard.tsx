import { Popover } from "@base-ui/react/popover"
import { useFormatter, useLocale } from "next-intl"
import { Fragment, memo, useCallback, useMemo } from "react"

import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { useFormatDuration } from "@v3/_/lib/formatters"
import { cn } from "@v3/_/lib/utils"

import { useCoverScope } from "@/app/(v3)/v3/_/components/books/BookDetails/sections/CoverScope"
import { Cover, isDual } from "@/app/(v3)/v3/_/components/books/Cover"
import { ProcessingIndicator } from "@/app/(v3)/v3/_/components/books/ProcessingIndicator"
import {
  ProgressDisplayBar,
  getReadingProgress,
} from "@/app/(v3)/v3/_/components/books/ProgressDisplayBar"
import { SelectionCheckbox } from "@/app/(v3)/v3/_/components/books/SelectionCheckbox"
import { GradePill } from "@/app/(v3)/v3/_/components/books/grade-pill"
import { bookItemDomId } from "@/app/(v3)/v3/_/components/books/keyboard-nav"
import { useUserPreferences } from "@/app/(v3)/v3/_/components/user-preferences-provider"
import { V3Link } from "@/app/(v3)/v3/_/components/v3-link"
import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { type BookWithRelations } from "@/database/books"
import * as icon from "@/icons"
import { type DisplayField, type SortContext } from "@/sort"
import { BookCover } from "../BookCover"

type BookCardProps = {
  book: BookWithRelations
  // absolute item index, surfaced as data-index so the virtualizer's FLIP can
  // find and animate the card on column-count changes.
  index?: number
  // stable fetch-resolution bucket for the cover (rendered card width). kept
  // stable rather than the live fluid width so fluid resize can't refetch.
  coverWidth?: number
  muted?: boolean
  selected?: boolean
  // roving keyboard cursor: container owns the tab stop, this card is the
  // active descendant when `active`.
  keyboardNav?: boolean
  active?: boolean
  isSelecting?: boolean
  isBookSelected?: boolean
  onToggleSelection?: (uuid: string) => void
  onSelectRange?: (uuid: string) => void
  onOpenMenu?: (book: BookWithRelations, anchor: HTMLElement) => void
  onClick?: (
    book: BookWithRelations,
    isSelecting: boolean,
    isBookSelected: boolean,
  ) => void
  displayFields?: DisplayField[]
  displayContext?: SortContext
  handle?: Popover.Handle<unknown>
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

export function SecondaryText({
  book,
  field,
  ctx,
}: {
  book: BookWithRelations
  field: DisplayField
  ctx: SortContext | undefined
}): React.ReactNode {
  const { dateTime, relativeTime } = useFormatter()
  const { ratingIcon } = useUserPreferences()
  const locale = useLocale()
  const formatDuration = useFormatDuration()

  const none = <span className="text-muted-foreground/80">{"\u2014"}</span>

  switch (field) {
    case "userRating":
      return book.userBookRating?.rating != null ? (
        <span>
          {ratingIcon === "star" ? "★" : "♥"}{" "}
          {book.userBookRating.rating.toFixed(2)}
        </span>
      ) : (
        none
      )
    case "seriesPosition": {
      if (!ctx?.seriesUuid) return null

      const s = book.series.find((x) => x.uuid === ctx.seriesUuid)
      if (!s || s.position == null) return none

      return (
        <span>
          #{s.position} in {s.name}
        </span>
      )
    }
    case "publicationDate":
      return book.publicationDate ? (
        <span>{book.publicationDate.slice(0, 4)}</span>
      ) : (
        none
      )
    case "createdAt":
      return (
        <span>
          {dateTime(new Date(book.createdAt), { dateStyle: "medium" })}
        </span>
      )
    case "updatedAt":
      return (
        <span>
          {relativeTime(new Date(book.updatedAt), {
            now: new Date(),
            style: "narrow",
          })}
        </span>
      )
    case "alignedAt":
      return book.alignedAt ? (
        <span>
          {dateTime(new Date(book.alignedAt), { dateStyle: "medium" })}
        </span>
      ) : (
        none
      )
    case "lastRead":
      return book.position?.updatedAt ? (
        <span>
          {relativeTime(new Date(book.position.updatedAt), {
            now: new Date(),
            style: "narrow",
          })}
        </span>
      ) : (
        none
      )
    case "pageCount": {
      const p = book.ebook?.pageCount ?? book.pageCount
      return p != null ? <span>{p} pages</span> : none
    }
    case "duration": {
      const d = book.audiobook?.duration ?? book.duration
      return d != null ? <span>{formatDuration(d)}</span> : none
    }
    case "fileSize": {
      const f = book.ebook?.fileSize ?? book.audiobook?.fileSize ?? null
      return f != null ? <span>{formatFileSize(f)}</span> : none
    }
    case "language":
      return book.language
        ? new Intl.DisplayNames([locale], {
            type: "language",
            languageDisplay: "dialect",
          }).of(book.language)
        : none
    case "title":
    case "authors":
      return null
    case "alignmentScore":
      return book.alignmentSummary?.score != null ? (
        <span>{Math.round(book.alignmentSummary.score)}%</span>
      ) : (
        none
      )
    case "alignmentGrade":
      return book.alignmentSummary?.grade ? (
        <GradePill grade={book.alignmentSummary.grade} />
      ) : (
        none
      )
    case "alignmentMissingSentences":
      return book.alignmentSummary?.missingSentences != null ? (
        <span>{book.alignmentSummary.missingSentences}</span>
      ) : (
        none
      )
    case "alignmentMutedChapters":
      return book.alignmentSummary?.mutedChapters != null ? (
        <span>{book.alignmentSummary.mutedChapters}</span>
      ) : (
        none
      )
    default: {
      const _exhaustive: never = field
      return null
    }
  }
}

export const BookCard = memo(function BookCard({
  book,
  index,
  coverWidth = 180,
  muted = false,
  selected = false,
  keyboardNav = false,
  active = false,
  isSelecting = false,
  isBookSelected = false,
  onToggleSelection,
  onSelectRange,
  onOpenMenu,
  onClick,
  displayFields = ["authors"],
  displayContext,
  handle,
}: BookCardProps) {
  const isMobile = useIsMobile()

  const hasReadaloud = book.readaloud !== null
  const isSynced = hasReadaloud && book.readaloud?.status === "ALIGNED"
  const isProcessing =
    book.readaloud?.status === "PROCESSING" ||
    book.readaloud?.status === "QUEUED"
  const hasDualFormat = isDual(book)

  const MAX_CARD_AUTHORS = 5
  const authors = book.authors
  const visibleAuthors = useMemo(
    () => authors.slice(0, MAX_CARD_AUTHORS),
    [authors],
  )
  const hiddenAuthorCount = authors.length - visibleAuthors.length
  const progress = getReadingProgress(book)

  const scope = useCoverScope(book)

  const cardContent = (
    <>
      <div className="relative flex aspect-13/16 shrink-0 flex-col items-center justify-center transition-shadow">
        <div className="from-cover-well to-cover-well/80 absolute inset-0 flex flex-col-reverse overflow-hidden rounded-lg bg-linear-to-t">
          {progress !== null && progress > 0 && (
            <ProgressDisplayBar progress={progress} book={book} />
          )}

          {isProcessing && (
            <ProcessingIndicator
              book={book}
              size={22}
              className="absolute right-1.5 bottom-1.5 z-10"
            />
          )}
        </div>

        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center p-2",
            hasDualFormat ? "overflow-visible" : "rounded-lg",
          )}
        >
          <Cover
            book={book}
            width={coverWidth}
            interactive={!isSelecting}
            className="rounded-lg"
          />
          {/* <BookCover
            book={book}
            width={coverWidth}
            disableHover={isSelecting}
          /> */}
        </div>

        {onToggleSelection && (
          <SelectionCheckbox
            uuid={book.uuid}
            checked={isBookSelected}
            isSelecting={isSelecting}
            onToggle={onToggleSelection}
            onSelectRange={onSelectRange}
            className="absolute top-1.5 left-1.5 z-30"
          />
        )}

        {isSynced && !isMobile && (
          <div className="absolute top-4.5 right-3">
            <div className="bg-accent flex size-5 items-center justify-center rounded-full shadow-md">
              <IconReadaloud className="size-6 text-white" />
            </div>
          </div>
        )}

        {onOpenMenu && handle && (
          <Popover.Trigger
            handle={handle}
            aria-label="Open menu"
            className={cn(
              "absolute bottom-2 left-1.5 z-20",
              "flex size-4 items-center justify-center rounded-full text-white transition-colors",
              !isMobile &&
                !handle.isOpen &&
                "opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
            )}
            onClick={(e) => {
              e.stopPropagation()
              onOpenMenu(book, e.currentTarget)
            }}
          >
            <icon.DotsVertical className="size-3.5" />
          </Popover.Trigger>
        )}
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden px-1">
        {displayFields.map((field) => (
          <p
            key={field}
            className="text-muted-foreground/80 line-clamp-1 text-xs tabular-nums"
          >
            <SecondaryText book={book} field={field} ctx={displayContext} />
          </p>
        ))}
        {displayFields.includes("authors") && authors.length > 0 && (
          <p className="text-muted-foreground/80 line-clamp-1 text-xs">
            {visibleAuthors.map((a, index) => (
              <Fragment key={a.uuid}>
                <V3Link
                  className="hover:text-tinted-strong relative z-20 hover:underline"
                  prefetch={false}
                  href={`/authors?item=${a.uuid}`}
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                >
                  {a.name}
                </V3Link>
                {index < visibleAuthors.length - 1 && ", "}
              </Fragment>
            ))}
            {hiddenAuthorCount > 0 && ` +${hiddenAuthorCount}`}
          </p>
        )}
        <V3Link
          href={`/books/${book.uuid}`}
          prefetch={false}
          className={cn(!onClick && "big-link")}
        >
          <h3 className="group-hover:text-tinted-strong font-heading line-clamp-2 text-[0.9375rem] leading-tight font-normal">
            {book.title}
          </h3>
        </V3Link>

        {/* <div className="flex items-center gap-1">
          {book.ebook?.coverColors?.map((color) => (
            <div
              key={color.toString()}
              className="size-4 rounded-full"
              style={{
                backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})`,
              }}
            />
          ))}
        </div> */}
      </div>
    </>
  )

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey && onSelectRange) {
        e.preventDefault()
        onSelectRange(book.uuid)
        return
      }

      onClick?.(book, isSelecting, isBookSelected)
    },
    [book, onClick, onSelectRange, isSelecting, isBookSelected],
  )

  return (
    <div
      data-book-uuid={book.uuid}
      {...(index !== undefined && { "data-index": index })}
      {...(keyboardNav && {
        id: bookItemDomId(book.uuid),
        role: "option",
        "aria-selected": active,
      })}
      className={cn(
        "group relative flex h-full min-h-0 flex-col rounded-lg transition-opacity duration-200",
        muted && "opacity-50",
        selected &&
          !isBookSelected &&
          "ring-accent/50 bg-tint-strong/20 [&_h3]:text-tinted-strong ring-offset-background ring-2 ring-offset-2",
        // the keyboard cursor reads as the focus ring even though dom focus
        // stays on the container.
        active && "rounded-lg ring-2 ring-blue-500 ring-offset-2 outline-none",
      )}
      {...scope}
    >
      <div
        key={book.uuid}
        role={keyboardNav ? undefined : "button"}
        onKeyDown={
          !keyboardNav && onClick
            ? (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  onClick(book, isSelecting, isBookSelected)
                }
              }
            : undefined
        }
        tabIndex={keyboardNav ? -1 : 0}
        onClick={onClick ? handleCardClick : undefined}
        className={cn(
          "relative flex min-h-0 flex-1 flex-col",
          isBookSelected && "ring-cover rounded-lg ring-2",
          !keyboardNav &&
            "focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
        )}
      >
        {cardContent}
      </div>
    </div>
  )
})
