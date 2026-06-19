import Link from "next/link"
import { Fragment, memo, useState } from "react"

import { Checkbox } from "@v3/_/components/ui/checkbox"
import { cn } from "@v3/_/lib/utils"

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
import { ProgressDisplayBar, getReadingProgress } from "./ProgressDisplayBar"

type BookCardProps = {
  book: BookWithRelations
  muted?: boolean
  selected?: boolean
  isSelecting?: boolean
  isBookSelected?: boolean
  onToggleSelection?: (uuid: string) => void
  onClick?: (book: BookWithRelations) => void
  // what the secondary line under the title shows; defaults to authors
  displayField?: DisplayField
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

// the formatted secondary text for a non-authors display field, or null when
// the book has no value for it (the card then falls back to authors).
function secondaryText(
  book: BookWithRelations,
  field: DisplayField,
  ctx: SortContext | undefined,
): string | null {
  switch (field) {
    case "userRating":
      return book.rating?.rating != null
        ? `★ ${book.rating.rating.toFixed(1)}`
        : null
    case "seriesPosition": {
      if (!ctx?.seriesUuid) return null
      const s = book.series.find((x) => x.uuid === ctx.seriesUuid)
      if (!s || s.position == null) return null
      return `#${s.position} in ${s.name}`
    }
    case "publicationDate":
      return book.publicationDate ? book.publicationDate.slice(0, 4) : null
    case "createdAt":
      return `Added ${new Date(book.createdAt).toLocaleDateString()}`
    case "updatedAt":
      return `Updated ${new Date(book.updatedAt).toLocaleDateString()}`
    case "pageCount": {
      const p = book.ebook?.pageCount ?? book.pageCount
      return p != null ? `${p} pages` : null
    }
    case "duration": {
      const d = book.audiobook?.duration ?? book.duration
      return d != null ? formatDuration(d) : null
    }
    case "fileSize": {
      const f = book.ebook?.fileSize ?? book.audiobook?.fileSize ?? null
      return f != null ? formatFileSize(f) : null
    }
    case "language":
      return book.language ?? null
    case "title":
    case "authors":
      return null
  }
}

export const BookCard = memo(function BookCard({
  book,
  muted = false,
  selected = false,
  isSelecting = false,
  isBookSelected = false,
  onToggleSelection,
  onClick,
  displayField = "authors",
  displayContext,
}: BookCardProps) {
  const hasReadaloud = book.readaloud !== null
  const isSynced = hasReadaloud && book.readaloud?.status === "ALIGNED"
  const hasDualFormat = isDualFormat(book)

  const authors = book.authors
  const progress = getReadingProgress(book)

  // non-authors fields render a plain muted line; a null value (or an explicit
  // authors/title pick) falls back to the author links below.
  const secondary =
    displayField === "authors"
      ? null
      : secondaryText(book, displayField, displayContext)
  const showAuthors = secondary === null

  const { primary, accent } = useCoverColors(book)
  const { showTint, showAccent, tint } = useColorPreferences()
  const isDark = useIsDarkMode()

  const [coverLoading, setCoverLoading] = useState(true)

  const showCheckbox = !!onToggleSelection

  const handleCheckboxClick = () => {
    onToggleSelection?.(book.uuid)
  }

  // cover-derived ui coloring (hover title, badge, accent vars) only at "full";
  // otherwise we leave the theme primary in place. the cover colors are nudged
  // for contrast against the active surface rather than falling back to orange.
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
        {/* rounded background sits behind the cover and always keeps its
            corners; it never clips the cover, so a dual cover can animate out
            of the frame on hover without the card rounding appearing to break */}
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
        </div>

        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center p-3",
            // single covers stay clipped to the card; a dual cover is allowed
            // to spill past the edges during its hover animation
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

        {showCheckbox && (
          <div
            className={cn(
              "absolute top-4.5 left-3 z-30 transition-opacity",
              !isBookSelected &&
                !isSelecting &&
                "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
            )}
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <Checkbox
              tabIndex={0}
              checked={isBookSelected}
              onCheckedChange={handleCheckboxClick}
              className="hover:border-primary relative h-5 w-5 rounded-full border-4 border-white shadow-sm transition-colors focus-within:border-blue-500 data-checked:border-2 data-checked:border-white"
              onClick={(e) => {
                e.stopPropagation()
              }}
            />
          </div>
        )}

        {isSynced && (
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
      </div>

      <div className="mt-2 flex flex-col gap-0.5 px-1">
        {!showAuthors && (
          <p className="text-muted-foreground/80 line-clamp-1 text-xs tabular-nums">
            {secondary}
          </p>
        )}
        {showAuthors && authors.length > 0 && (
          <p className="text-muted-foreground/80 line-clamp-1 text-xs">
            {authors.map((a, index) => {
              return (
                <Fragment key={a.uuid}>
                  <Link
                    key={a.uuid}
                    className="hover:text-primary relative z-20 hover:underline"
                    prefetch={false}
                    href={`/v3/authors?item=${a.uuid}`}
                    onClick={(e) => {
                      // otherwise clicking the link would toggle selection
                      e.stopPropagation()
                    }}
                  >
                    {a.name}
                  </Link>
                  {index < authors.length - 1 && ", "}
                </Fragment>
              )
            })}
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

  return (
    <div
      data-book-uuid={book.uuid}
      className={cn(
        "group relative flex flex-col rounded-lg transition-opacity duration-200",
        muted && "opacity-50",
        // book currently open in the detail panel: a soft, persistent cue that
        // reads differently from the bold multi-select ring below.
        selected &&
          !isBookSelected &&
          "ring-primary/40 bg-primary/5 [&_h3]:text-primary ring-2 ring-offset-2",
      )}
      style={style}
    >
      <div
        key={book.uuid}
        // im sorry a11y gods
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
        onClick={
          onClick
            ? () => {
                onClick(book)
              }
            : undefined
        }
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
