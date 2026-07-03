import { IconDotsVertical } from "@tabler/icons-react"
import { useFormatter, useLocale } from "next-intl"
import Link from "next/link"
import { Fragment, memo, useCallback, useMemo, useState } from "react"

import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { cn } from "@v3/_/lib/utils"

import { Button } from "@/app/(v3)/v3/_/components/ui/button"
import { useUserPreferences } from "@/app/(v3)/v3/_/components/user-preferences-provider"
import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { type BookWithRelations } from "@/database/books"
import { type DisplayField, type SortContext } from "@/sort"

import { BookCover, isDualFormat } from "./BookCover"
import {
  ensureContrast,
  useColorPreferences,
  useCoverColors,
  useIsDarkMode,
} from "./BookDetails/sections/useCoverColors"
import { ProcessingIndicator } from "./ProcessingIndicator"
import { ProgressDisplayBar, getReadingProgress } from "./ProgressDisplayBar"
import { SelectionCheckbox } from "./SelectionCheckbox"
import { GradePill } from "./grade-pill"

type BookCardProps = {
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
  displayFields?: DisplayField[]
  displayContext?: SortContext
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
  muted = false,
  selected = false,
  isSelecting = false,
  isBookSelected = false,
  onToggleSelection,
  onSelectRange,
  onOpenMenu,
  isMenuOpen = false,
  onClick,
  displayFields = ["authors"],
  displayContext,
}: BookCardProps) {
  const isMobile = useIsMobile()

  const hasReadaloud = book.readaloud !== null
  const isSynced = hasReadaloud && book.readaloud?.status === "ALIGNED"
  const isProcessing =
    book.readaloud?.status === "PROCESSING" ||
    book.readaloud?.status === "QUEUED"
  const hasDualFormat = isDualFormat(book)

  const MAX_CARD_AUTHORS = 5
  const authors = book.authors
  const visibleAuthors = useMemo(
    () => authors.slice(0, MAX_CARD_AUTHORS),
    [authors],
  )
  const hiddenAuthorCount = authors.length - visibleAuthors.length
  const progress = getReadingProgress(book)

  const { primary, accent } = useCoverColors(book)
  const { showTint, showAccent, tint } = useColorPreferences()
  const isDark = useIsDarkMode()

  const [coverLoading, setCoverLoading] = useState(true)

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

  const cardContent = (
    <>
      <div className="relative flex aspect-13/16 flex-col items-center justify-center transition-shadow">
        <div
          className={cn(
            "bg-muted absolute inset-0 flex flex-col-reverse overflow-hidden rounded-lg",
            coverLoading && "animate-pulse",
          )}
          style={showTint ? { background: tint(primary, 0.36) } : undefined}
        >
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
            "absolute inset-0 flex items-center justify-center p-3",
            hasDualFormat ? "overflow-visible" : "overflow-hidden rounded-lg",
          )}
        >
          <BookCover
            book={book}
            width={300}
            disableHover={isSelecting}
            onLoadingChange={setCoverLoading}
          />
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
            <div
              className="flex size-5 items-center justify-center rounded-full shadow-md"
              style={{
                background: showAccent ? cPrimary.solid : "var(--primary)",
              }}
            >
              <IconReadaloud className="size-6 text-white" />
            </div>
          </div>
        )}

        {onOpenMenu && (
          <Button
            variant="secondary"
            aria-label="Open menu"
            size="icon"
            className={cn(
              "absolute bottom-2 left-1.5 z-20",
              "flex size-4 items-center justify-center rounded-full text-white transition-colors",
              !isMobile &&
                !isMenuOpen &&
                "opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
            )}
            onClick={(e) => {
              e.stopPropagation()
              onOpenMenu(book, e.currentTarget)
            }}
          >
            <IconDotsVertical className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-0.5 px-1">
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
                <Link
                  className="hover:text-primary relative z-20 hover:underline"
                  prefetch={false}
                  href={`/v3/authors?item=${a.uuid}`}
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                >
                  {a.name}
                </Link>
                {index < visibleAuthors.length - 1 && ", "}
              </Fragment>
            ))}
            {hiddenAuthorCount > 0 && ` +${hiddenAuthorCount}`}
          </p>
        )}
        <Link
          href={`/v3/books/${book.uuid}`}
          prefetch={false}
          className={cn(!onClick && "big-link")}
        >
          <h3 className="group-hover:text-primary font-heading line-clamp-2 text-[0.9375rem] leading-tight font-normal">
            {book.title}
          </h3>
        </Link>
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

      onClick?.(book)
    },
    [book, onClick, onSelectRange],
  )

  return (
    <div
      data-book-uuid={book.uuid}
      className={cn(
        "group relative flex flex-col rounded-lg transition-opacity duration-200",
        muted && "opacity-50",
        selected &&
          !isBookSelected &&
          "ring-primary/40 bg-primary/5 [&_h3]:text-primary ring-2 ring-offset-2",
      )}
      style={style}
    >
      <div
        key={book.uuid}
        role="button"
        onKeyDown={
          onClick
            ? (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  onClick(book)
                }
              }
            : undefined
        }
        tabIndex={0}
        onClick={onClick ? handleCardClick : undefined}
        className={cn(
          "relative h-full",
          isBookSelected && "ring-primary rounded-lg ring-2",
          "focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
        )}
      >
        {cardContent}
      </div>
    </div>
  )
})
