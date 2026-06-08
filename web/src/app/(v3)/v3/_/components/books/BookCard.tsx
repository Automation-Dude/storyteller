import Link from "next/link"
import { memo, useState } from "react"

import { Checkbox } from "@v3/_/components/ui/checkbox"
import { cn } from "@v3/_/lib/utils"

import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { type BookWithRelations } from "@/database/books"

import { BookCover, isDualFormat } from "./BookCover"
import {
  useColorPreferences,
  useCoverColors,
} from "./BookDetails/sections/useCoverColors"
import { ProgressDisplayBar } from "./ProgressDisplayBar"

type BookCardProps = {
  book: BookWithRelations
  muted?: boolean
  selected?: boolean
  isSelecting?: boolean
  isBookSelected?: boolean
  onToggleSelection?: (uuid: string) => void
  onClick?: (book: BookWithRelations) => void
}

function getReadingProgress(book: BookWithRelations): number | null {
  if (!book.position?.locator.locations?.totalProgression) return null
  return book.position.locator.locations.totalProgression
}

export const BookCard = memo(function BookCard({
  book,
  muted = false,
  selected = false,
  isSelecting = false,
  isBookSelected = false,
  onToggleSelection,
  onClick,
}: BookCardProps) {
  const hasReadaloud = book.readaloud !== null
  const isSynced = hasReadaloud && book.readaloud?.status === "ALIGNED"
  const hasDualFormat = isDualFormat(book)

  const authors = book.authors
  const progress = getReadingProgress(book)

  const { primary, accent } = useCoverColors(book)
  const { showTint, showAccent, tint } = useColorPreferences()

  const [coverLoading, setCoverLoading] = useState(true)

  const showCheckbox = !!onToggleSelection

  const handleCheckboxClick = () => {
    onToggleSelection?.(book.uuid)
  }

  // cover-derived ui coloring (hover title, badge, accent vars) only at "full";
  // otherwise we leave the theme primary in place
  const style = showAccent
    ? ({
        "--primary": primary.isDark ? primary.solid : `var(--st-orange-500)`,
        "--primary-foreground": primary.isDark
          ? primary.onColor
          : `var(--st-orange-500-foreground)`,
        "--primary-accent": accent.isDark
          ? accent.solid
          : `var(--st-orange-500)`,
        "--primary-accent-foreground": accent.isDark
          ? accent.onColor
          : `var(--st-orange-500-foreground)`,
      } as React.CSSProperties)
    : undefined

  const cardContent = (
    <>
      <div
        className={cn(
          "relative flex aspect-13/16 flex-col items-center justify-center transition-shadow",
          hasDualFormat
            ? "overflow-x-visible overflow-y-clip rounded-lg"
            : "overflow-hidden rounded-lg",
        )}
      >
        <div
          className={cn(
            "bg-muted flex h-full w-full items-center justify-center p-3",
            coverLoading && "animate-pulse",
          )}
          style={showTint ? { background: tint(primary, 0.36) } : undefined}
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
              "absolute top-2 left-2 z-20 transition-opacity",
              !isBookSelected &&
                !isSelecting &&
                "opacity-0 group-hover:opacity-100",
            )}
          >
            <Checkbox
              checked={isBookSelected}
              onCheckedChange={handleCheckboxClick}
              className="hover:border-primary h-5 w-5 rounded-full border-4 border-white shadow-sm transition-colors"
              tabIndex={-1}
            />
          </div>
        )}

        {isSynced && (
          <div className="absolute top-2 right-2">
            <div
              className="flex size-5 items-center justify-center rounded-full shadow-md"
              style={{
                background: showAccent ? primary.solid : "var(--primary)",
              }}
            >
              <IconReadaloud className="size-6 text-white" />
            </div>
          </div>
        )}
        {progress !== null && progress > 0 && (
          <ProgressDisplayBar progress={progress} book={book} />
        )}
      </div>

      <div className="mt-2 flex flex-col gap-0.5 px-1">
        {authors.length > 0 && (
          <p className="text-muted-foreground/80 line-clamp-1 text-xs">
            {authors.map((a) => a.name).join(", ")}
          </p>
        )}
        <h3 className="group-hover:text-primary font-heading line-clamp-2 text-[0.9375rem] leading-tight font-normal">
          {book.title}
        </h3>
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
      {onClick ? (
        <div
          key={book.uuid}
          // im sorry a11y gods
          role="button"
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              onClick(book)
            }
          }}
          tabIndex={0}
          onClick={() => {
            onClick(book)
          }}
          className={cn(
            "h-full",
            isBookSelected && "ring-primary rounded-lg ring-2 ring-offset-2",
            "focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
          )}
        >
          {cardContent}
        </div>
      ) : (
        <Link href={`/v3/books/${book.uuid}`}>{cardContent}</Link>
      )}
    </div>
  )
})
