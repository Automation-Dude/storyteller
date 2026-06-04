"use client"

import { IconBookFilled, IconHeadphonesFilled } from "@tabler/icons-react"

import { type JsColor } from "@storyteller-platform/okmain"

import { cn } from "@/cn"
import { type BookWithRelations } from "@/database/books"
import { getCoverUrl } from "@/store/api"

import { useCoverColors } from "./BookDetails/sections/useCoverColors"
import { BookDoubleCover } from "./BookDoubleCover"
import { CoverImage } from "./CoverImage"

const DPR =
  typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 3) : 2

export function isDualFormat(book: BookWithRelations): boolean {
  const isSynced =
    book.readaloud !== null && book.readaloud.status === "ALIGNED"

  return isSynced || (book.ebook !== null && book.audiobook !== null)
}

export function BookCover({
  book,
  width,
  disableHover = false,
  onLoadingChange,
}: {
  book: BookWithRelations
  width: number
  disableHover?: boolean
  onLoadingChange?: (loading: boolean) => void
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
      <BookDoubleCover
        book={book}
        width={width}
        disableHover={disableHover}
        onLoadingChange={onLoadingChange}
      />
    )
  }

  const imgClassName = cn(
    "rounded-lg object-contain",
    // !disableHover && "transition-transform duration-300 group-hover:scale-105",
  )

  if (hasAudiobook && !hasEbook) {
    return (
      <CoverImage
        src={audiobookCoverUrl}
        alt={book.title}
        blurhash={book.audiobook?.coverBlurhash}
        type="audiobook"
        fallbackColors={book.audiobook?.coverColors}
        className="aspect-square w-full shadow-lg"
        imgClassName={imgClassName}
        onLoadingChange={onLoadingChange}
      />
    )
  }

  return (
    <CoverImage
      src={ebookCoverUrl}
      alt={book.title}
      blurhash={book.ebook?.coverBlurhash}
      type="ebook"
      fallbackColors={book.ebook?.coverColors}
      className="h-full"
      imgClassName={imgClassName}
      onLoadingChange={onLoadingChange}
    />
  )
}

export function FallbackCover({
  title,
  type,
  colors,
  className,
}: {
  title: string
  type: "audiobook" | "ebook"
  className?: string
  colors?: JsColor[] | null
}) {
  const { primary } = useCoverColors(colors ?? [])

  return (
    <div
      className={cn(
        "from-primary/10 to-primary/5 relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-clip rounded-lg bg-linear-to-br p-4 text-center before:absolute before:inset-0 before:-z-10 before:bg-white before:content-['']",
        className,
      )}
      style={{
        background: primary.solid,
      }}
    >
      {type === "audiobook" ? (
        <IconHeadphonesFilled
          className="h-12 w-12"
          style={{ color: primary.onColor }}
        />
      ) : (
        <IconBookFilled
          className="h-12 w-12"
          style={{ color: primary.onColor }}
        />
      )}
      <h3
        className="line-clamp-2 max-w-full text-center text-sm font-medium"
        style={{ color: primary.onColor }}
      >
        {title}
      </h3>
    </div>
  )
}
