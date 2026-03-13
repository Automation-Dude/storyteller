import { IconBook, IconRefresh } from "@tabler/icons-react"
import Image from "next/image"
import { useCallback, useMemo, useState } from "react"

import { type BookWithRelations } from "@/database/books"
import { getCoverUrl } from "@/store/api"

import { Checkbox } from "@v3/_/components/ui/checkbox"
import { Skeleton } from "@v3/_/components/ui/skeleton"
import { V3Link } from "@v3/_/components/v3-link"
import { useOptionalBookSelection } from "@v3/_/hooks/use-book-selection"
import { cn } from "@v3/_/lib/utils"

type BookCardProps = {
  book: BookWithRelations
  muted?: boolean
}

function getReadingProgress(book: BookWithRelations): number | null {
  if (!book.position?.locator.locations?.totalProgression) return null
  return book.position.locator.locations.totalProgression
}

function CoverImage({
  height,
  width,
  uuid,
  updatedAt,
  alt,
  className,
  onError,
}: {
  height: number
  width: number
  uuid: string
  updatedAt: string
  alt: string
  className?: string
  onError?: () => void
}) {
  return (
    <img
      height={height}
      width={width}
      src={getCoverUrl(uuid, {
        width: width,
        height: height,
        updatedAt: updatedAt,
      })}
      alt={alt}
      loading="lazy"
      onError={onError}
      className={cn(
        "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
        className,
      )}
    />
  )
}

function FallbackCover({ title }: { title: string }) {
  return (
    <div className="from-primary/10 to-primary/5 flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br p-4 text-center">
      <IconBook className="text-muted-foreground/50 h-12 w-12" />
      <span className="text-muted-foreground line-clamp-3 text-sm font-medium">
        {title}
      </span>
    </div>
  )
}

export function BookCard({ book, muted = false }: BookCardProps) {
  const [ebookError, setEbookError] = useState(false)
  const [audiobookError, setAudiobookError] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  const selection = useOptionalBookSelection()
  const isSelecting = selection?.isSelecting ?? false
  const isSelected = selection?.isSelected(book.uuid) ?? false
  const toggleSelection = selection?.toggleSelection
  const startSelecting = selection?.startSelecting

  const hasAudiobook = book.audiobook !== null
  const hasEbook = book.ebook !== null
  const hasReadaloud = book.readaloud !== null
  const isSynced = hasReadaloud && book.readaloud?.status === "ALIGNED"

  const authors = book.authors
  const narrators = book.narrators
  const primarySeries = book.series.find((s) => s.featured) ?? book.series[0]
  const progress = getReadingProgress(book)

  const ebookCoverUrl = getCoverUrl(book.uuid, {
    width: 300,
    height: 450,
    audio: false,
    updatedAt: book.ebook?.updatedAt ?? book.updatedAt,
  })
  const audiobookCoverUrl = getCoverUrl(book.uuid, {
    width: 100,
    height: 100,
    audio: true,
    updatedAt: book.audiobook?.updatedAt ?? book.updatedAt,
  })

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      console.log("handleCheckboxClick", e)
      e.preventDefault()
      e.stopPropagation()
      if (!isSelecting) {
        startSelecting?.()
      }
      toggleSelection?.(book.uuid)
    },
    [toggleSelection, book.uuid, isSelecting, startSelecting],
  )

  const showCheckbox = isSelecting || isHovering

  const cover = useMemo(() => {
    // synced: show both covers stacked (ebook in front, audiobook behind)
    if (isSynced || (hasEbook && hasAudiobook)) {
      return (
        <div className="relative h-full w-full">
          {!audiobookError ? (
            <div className="absolute top-3/4 left-3/4 z-10 h-24 w-24 -translate-x-2/3 -translate-y-1/2 border-1 border-white/20 shadow-lg shadow-white/20">
              <div className="h-full w-full overflow-hidden rounded-md">
                <img
                  src={audiobookCoverUrl}
                  alt=""
                  height={100}
                  width={100}
                  loading="lazy"
                  onError={() => {
                    setAudiobookError(true)
                  }}
                  crossOrigin="use-credentials"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          ) : (
            <div className="bg-muted absolute top-1 left-1 h-[80%] w-[80%] rounded-md" />
          )}
          <div className="absolute right-0 bottom-0 h-full w-full overflow-hidden rounded-lg transition-transform duration-300 group-hover:scale-105">
            {!audiobookError && (
              <div className="absolute top-0 left-0 h-full w-full overflow-hidden rounded-lg bg-gradient-to-t from-black/20 to-transparent shadow-lg" />
            )}
            {!ebookError ? (
              <CoverImage
                height={450}
                width={300}
                uuid={book.uuid}
                updatedAt={book.updatedAt}
                alt={book.title}
                onError={() => {
                  setEbookError(true)
                }}
              />
            ) : (
              <FallbackCover title={book.title} />
            )}
          </div>
        </div>
      )
    }

    // audiobook only: square aspect ratio, slightly smaller
    if (hasAudiobook && !hasEbook) {
      return (
        <div className="flex h-full w-full items-center justify-center p-3">
          <div className="aspect-square w-full overflow-hidden rounded-lg shadow-lg transition-transform duration-300 group-hover:scale-105">
            {!audiobookError ? (
              <img
                src={audiobookCoverUrl}
                alt={book.title}
                loading="lazy"
                onError={() => {
                  setAudiobookError(true)
                }}
                className="h-full w-full object-cover"
              />
            ) : (
              <FallbackCover title={book.title} />
            )}
          </div>
        </div>
      )
    }

    // ebook only (default)
    if (!ebookError) {
      return (
        <CoverImage
          height={450}
          width={300}
          uuid={book.uuid}
          updatedAt={book.updatedAt}
          alt={book.title}
          onError={() => {
            setEbookError(true)
          }}
        />
      )
    }

    return <FallbackCover title={book.title} />
  }, [
    book.uuid,
    book.updatedAt,
    book.title,
    isSynced,
    hasEbook,
    hasAudiobook,
    audiobookError,
    ebookError,
    audiobookCoverUrl,
  ])

  const cardContent = (
    <>
      <div className="bg-muted relative aspect-2/3 overflow-hidden rounded-lg shadow-md transition-shadow group-hover:shadow-xl">
        {cover}

        {selection && showCheckbox && (
          <div
            className={cn(
              "absolute top-2 left-2 z-20 transition-opacity",
              !isSelecting &&
                !isSelected &&
                "opacity-0 group-hover:opacity-100",
            )}
            onClick={handleCheckboxClick}
          >
            <Checkbox
              checked={isSelected}
              className="bg-background/80 h-5 w-5 border-2 shadow-sm backdrop-blur"
            />
          </div>
        )}

        {isSynced && (
          <div className="absolute top-2 right-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 shadow-md">
              <IconRefresh className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
        )}

        {primarySeries && (
          <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/80 to-transparent px-2 pt-6 pb-2">
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
        <h3
          className="group-hover:text-primary line-clamp-2 text-sm leading-tight font-medium"
          style={{
            viewTransitionName: `book-title-${book.uuid}`,
          }}
        >
          {book.title}
        </h3>
        {authors.length > 0 && (
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {authors.map((a) => a.name).join(", ")}
          </p>
        )}
        {narrators.length > 0 && hasAudiobook && (
          <p className="text-muted-foreground/70 line-clamp-1 text-xs">
            Narrated by {narrators.map((n) => n.name).join(", ")}
          </p>
        )}
      </div>
    </>
  )

  // when selecting, clicking the card toggles selection instead of navigating
  if (isSelecting) {
    return (
      <div
        className={cn(
          "group relative flex cursor-pointer flex-col transition-opacity duration-200",
          muted && "opacity-50",
          isSelected && "ring-primary rounded-lg ring-2 ring-offset-2",
        )}
        onClick={() => toggleSelection?.(book.uuid)}
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

  return (
    <V3Link
      href={`/books/${book.uuid}`}
      className={cn(
        "group relative flex flex-col transition-opacity duration-200",
        muted && "opacity-50",
      )}
      onMouseEnter={() => {
        setIsHovering(true)
      }}
      onMouseLeave={() => {
        setIsHovering(false)
      }}
    >
      {cardContent}
    </V3Link>
  )
}

export function BookCardSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="aspect-[2/3] rounded-lg" />
      <div className="mt-2 flex flex-col gap-1 px-1">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  )
}
