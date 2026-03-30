import { IconBookFilled, IconHeadphonesFilled } from "@tabler/icons-react"
import { useState } from "react"

import { cn } from "@/cn"
import { type BookWithRelations } from "@/database/books"
import { getCoverUrl } from "@/store/api"

import { BlurhashCanvas } from "./BlurhashCanvas"
import { BookDoubleCover } from "./BookDoubleCover"

const DPR =
  typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 3) : 2

export function isDualFormat(book: BookWithRelations): boolean {
  const isSynced =
    book.readaloud !== null && book.readaloud.status === "ALIGNED"

  return isSynced || (book.ebook !== null && book.audiobook !== null)
}

function CoverImage({
  src,
  alt,
  blurhash,
  type,
  disableHover,
  className,
}: {
  src: string
  alt: string
  blurhash: string | null | undefined
  type: "audiobook" | "ebook"
  disableHover?: boolean
  className?: string
}) {
  const [error, setError] = useState(false)

  const hasBlurhash = !!blurhash
  const showFallback = error && !hasBlurhash

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <BlurhashCanvas blurhash={blurhash} />

      {!error && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setError(true)}
          className={cn(
            "relative z-10 h-full w-full rounded-lg object-contain",
            !disableHover &&
              "transition-transform duration-300 group-hover:scale-105",
          )}
        />
      )}

      {showFallback && <FallbackCover title={alt} type={type} />}
    </div>
  )
}

export function BookCover({
  book,
  width,
  disableHover = false,
}: {
  book: BookWithRelations
  width: number
  disableHover?: boolean
}) {
  const hasAudiobook = book.audiobook !== null
  const hasEbook = book.ebook !== null

  const scaledWidth = Math.round(width * DPR)
  const scaledHeight = Math.round(width * 1.5 * DPR)
  const scaledAudioSize = Math.round(width * DPR)

  const ebookCoverUrl = getCoverUrl(book.uuid, {
    width: scaledWidth,
    height: scaledHeight,
    audio: false,
    updatedAt: book.ebook?.updatedAt ?? book.updatedAt,
  })

  const audiobookCoverUrl = getCoverUrl(book.uuid, {
    width: scaledAudioSize,
    height: scaledAudioSize,
    audio: true,
    updatedAt: book.audiobook?.updatedAt ?? book.updatedAt,
  })

  if (isDualFormat(book)) {
    return (
      <BookDoubleCover book={book} width={width} disableHover={disableHover} />
    )
  }

  if (hasAudiobook && !hasEbook) {
    return (
      <CoverImage
        src={audiobookCoverUrl}
        alt={book.title}
        blurhash={book.audiobook?.coverBlurhash}
        type="audiobook"
        disableHover={disableHover}
        className="aspect-square w-full rounded-lg shadow-lg"
      />
    )
  }

  return (
    <CoverImage
      src={ebookCoverUrl}
      alt={book.title}
      blurhash={book.ebook?.coverBlurhash}
      type="ebook"
      disableHover={disableHover}
      className="h-full rounded-lg"
    />
  )
}

export function FallbackCover({
  title,
  type,
  className,
}: {
  title: string
  type: "audiobook" | "ebook"
  className?: string
}) {
  return (
    <div
      className={cn(
        "from-primary/10 to-primary/5 relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-clip rounded-lg bg-linear-to-br p-4 text-center before:absolute before:inset-0 before:-z-10 before:bg-white before:content-['']",
        className,
      )}
    >
      {type === "audiobook" ? (
        <IconHeadphonesFilled className="text-muted-foreground/50 h-12 w-12" />
      ) : (
        <IconBookFilled className="text-muted-foreground/50 h-12 w-12" />
      )}
      <h3 className="text-muted-foreground line-clamp-2 max-w-full text-center text-sm font-medium">
        {title}
      </h3>
    </div>
  )
}
