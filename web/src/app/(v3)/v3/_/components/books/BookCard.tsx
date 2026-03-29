import Link from "next/link"
import { memo, useCallback } from "react"

import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { type BookWithRelations } from "@/database/books"

import { Checkbox } from "@v3/_/components/ui/checkbox"
import { cn } from "@v3/_/lib/utils"

import { BookCover, isDualFormat } from "./BookCover"
import { BlurhashCanvas } from "./BlurhashCanvas"

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
  isSelecting = false,
  isBookSelected = false,
  onToggleSelection,
  onClick,
}: BookCardProps) {
  const hasReadaloud = book.readaloud !== null
  const isSynced = hasReadaloud && book.readaloud?.status === "ALIGNED"
  const hasDualFormat = isDualFormat(book)

  const authors = book.authors
  const primarySeries = book.series.find((s) => s.featured) ?? book.series[0]
  const progress = getReadingProgress(book)

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      onToggleSelection?.(book.uuid)
    },
    [onToggleSelection, book.uuid],
  )

  const showCheckbox = !!onToggleSelection

  const cardContent = (
    <>
      <div
        className={cn(
          "relative flex aspect-[13/16] flex-col items-center justify-center transition-shadow",
          hasDualFormat
            ? "overflow-x-visible overflow-y-clip rounded-lg"
            : "overflow-hidden rounded-lg",
        )}
      >
        <BlurhashCanvas
          className="from-primary/10 to-primary/5 rounded-lg bg-linear-to-br opacity-30"
          blurhash={
            book.readaloud?.coverBlurhash ||
            book.ebook?.coverBlurhash ||
            book.audiobook?.coverBlurhash ||
            null
          }
        />
        <div className="flex h-full w-full items-center justify-center p-3">
          <BookCover book={book} width={300} disableHover={isSelecting} />
        </div>

        {showCheckbox && (
          <div
            className={cn(
              "absolute top-2 left-2 z-20 transition-opacity",
              !isBookSelected &&
                !isSelecting &&
                "opacity-0 group-hover:opacity-100",
            )}
            onClick={handleCheckboxClick}
          >
            <Checkbox
              checked={isBookSelected}
              onCheckedChange={() => {
                onToggleSelection(book.uuid)
              }}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
              }}
              className="hover:border-primary h-5 w-5 rounded-full border-4 border-white shadow-sm transition-colors"
              tabIndex={-1}
            />
          </div>
        )}

        {isSynced && (
          <div className="absolute top-2 right-2">
            <div className="bg-primary flex size-5 items-center justify-center rounded-full shadow-md">
              <IconReadaloud className="size-6 text-white" />
            </div>
          </div>
        )}

        {/* {primarySeries && (
          <div
            className={cn(
              "absolute right-0 bottom-0 left-0 z-20 px-2 pt-6 pb-2",
              "bg-linear-to-t from-black/50 via-black/20 to-transparent",
              hasDualFormat && "rounded-b-lg",
            )}
          >
            <span
              className={cn(
                "text-muted-foreground line-clamp-1 text-xs font-medium",
                "text-white/90",
              )}
            >
              {primarySeries.name}
              {primarySeries.position && ` #${primarySeries.position}`}
            </span>
          </div>
        )} */}

        {progress !== null && progress > 0 && (
          <div className="absolute right-0 bottom-0 left-0 h-1 bg-black/30">
            <div
              className="h-full bg-orange-500 transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-0.5 px-1">
        {authors.length > 0 && (
          <p className="text-muted-foreground/80 line-clamp-1 text-xs">
            {authors.map((a) => a.name).join(", ")}
          </p>
        )}
        <h3 className="group-hover:text-primary line-clamp-2 text-sm leading-tight font-medium">
          {book.title}
        </h3>
      </div>
    </>
  )

  return onClick ? (
    <div
      key={book.uuid}
      // im sorry a11y gods
      role="button"
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          e.stopPropagation()
          if (isSelecting) {
            onToggleSelection?.(book.uuid)
          } else {
            onClick(book)
          }
        }
      }}
      tabIndex={0}
      onClick={() => {
        if (isSelecting) {
          onToggleSelection?.(book.uuid)
        } else {
          onClick(book)
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col transition-opacity duration-200",
        muted && "opacity-50",
        isBookSelected && "ring-primary rounded-lg ring-2 ring-offset-2",
        "focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
      )}
    >
      {cardContent}
    </div>
  ) : (
    <Link
      href={`/v3/books/${book.uuid}`}
      className={cn(
        "group relative flex flex-col transition-opacity duration-200",
        muted && "opacity-50",
      )}
    >
      {cardContent}
    </Link>
  )
})
