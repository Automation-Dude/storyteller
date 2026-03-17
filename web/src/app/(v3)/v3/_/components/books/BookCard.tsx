import Link from "next/link"
import { memo, useCallback, useState } from "react"

import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { type BookWithRelations } from "@/database/books"

import { Checkbox } from "@v3/_/components/ui/checkbox"
import { cn } from "@v3/_/lib/utils"

import { BookCover, isDualFormat } from "./BookCover"

type BookCardProps = {
  book: BookWithRelations
  muted?: boolean
  selected?: boolean
  isSelecting?: boolean
  isBookSelected?: boolean
  onToggleSelection?: (uuid: string) => void
  onStartSelecting?: () => void
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
  onStartSelecting,
  onClick,
}: BookCardProps) {
  const [isHovering, setIsHovering] = useState(false)

  const hasAudiobook = book.audiobook !== null
  const hasReadaloud = book.readaloud !== null
  const isSynced = hasReadaloud && book.readaloud?.status === "ALIGNED"
  const hasDualFormat = isDualFormat(book)

  const authors = book.authors
  const narrators = book.narrators
  const primarySeries = book.series.find((s) => s.featured) ?? book.series[0]
  const progress = getReadingProgress(book)

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (!isSelecting) {
        onStartSelecting?.()
      }

      onToggleSelection?.(book.uuid)
    },
    [onToggleSelection, book.uuid, isSelecting, onStartSelecting],
  )

  const showCheckbox = onToggleSelection && (isSelecting || isHovering)

  const cardContent = (
    <>
      <div
        className={cn(
          "relative flex aspect-2/3 flex-col items-center justify-center transition-shadow",
          hasDualFormat
            ? "bg-muted overflow-visible rounded-lg shadow-md"
            : "bg-muted overflow-hidden rounded-lg shadow-md group-hover:shadow-xl",
        )}
      >
        <BookCover book={book} width={300} />

        {showCheckbox && (
          <div
            className={cn(
              "absolute top-2 left-2 z-20 transition-opacity",
              !isSelecting &&
                !isBookSelected &&
                "opacity-0 group-hover:opacity-100",
            )}
            onClick={handleCheckboxClick}
          >
            <Checkbox
              checked={isBookSelected}
              onCheckedChange={() => {
                if (!isSelecting) onStartSelecting?.()
                onToggleSelection(book.uuid)
              }}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
              }}
              className="bg-background/80 h-5 w-5 border-2 shadow-sm backdrop-blur"
              tabIndex={-1}
            />
          </div>
        )}

        {isSynced && (
          <div className="absolute top-2 right-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 shadow-md">
              <IconReadaloud className="size-6 text-white" />
            </div>
          </div>
        )}

        {primarySeries && (
          <div className="absolute right-0 bottom-0 left-0 bg-linear-to-t from-black/30 via-black/10 to-transparent px-2 pt-6 pb-2">
            <span className="line-clamp-1 text-xs font-medium text-white/90">
              {primarySeries.name}
              {primarySeries.position && ` #${primarySeries.position}`}
            </span>
          </div>
        )}

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
        <h3 className="group-hover:text-primary line-clamp-2 text-sm leading-tight font-medium">
          {book.title}
        </h3>

        {authors.length > 0 && (
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {authors.map((a) => a.name).join(", ")}
          </p>
        )}

        {/* {narrators.length > 0 && hasAudiobook && (
          <p className="text-muted-foreground/70 line-clamp-1 text-xs">
            Narrated by {narrators.map((n) => n.name).join(", ")}
          </p>
        )} */}
      </div>
    </>
  )

  if (isSelecting) {
    return (
      <div
        className={cn(
          "group relative flex cursor-pointer flex-col transition-opacity duration-200",
          muted && "opacity-50",
          isBookSelected && "ring-primary rounded-lg ring-2 ring-offset-2",
        )}
        onClick={() => {
          onToggleSelection?.(book.uuid)
        }}
        onMouseEnter={() => {
          setIsHovering(true)
        }}
        onMouseLeave={() => {
          setIsHovering(false)
        }}
      >
        {cardContent}
      </div>
    )
  }

  return onClick ? (
    <div
      key={book.uuid}
      onClick={() => {
        onClick(book)
      }}
      onMouseEnter={() => {
        setIsHovering(true)
      }}
      onMouseLeave={() => {
        setIsHovering(false)
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col transition-opacity duration-200",
        muted && "opacity-50",
        selected && "ring-primary rounded-lg ring-2 ring-offset-2",
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
