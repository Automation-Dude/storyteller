"use client"

import { type JsColor } from "@storyteller-platform/okmain"

import { useUserPreferences } from "@/app/(v3)/v3/_/components/user-preferences-provider"
import { cn } from "@/cn"
import { type BookWithRelations } from "@/database/books"
import * as icon from "@/icons"
import { getCoverUrl } from "@/store/api"

import { useCoverColors } from "./BookDetails/sections/useCoverColors"
import { BookDoubleCover } from "./BookDoubleCover"
import { CoverImage } from "./CoverImage"

const DPR =
  typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1

export function isDualFormat(book: BookWithRelations): boolean {
  const isSynced =
    book.readaloud !== null && book.readaloud.status === "ALIGNED"

  return isSynced || (book.ebook !== null && book.audiobook !== null)
}

export function BookCover({
  book,
  width,
  disableHover = false,
  displayMode = "auto",
  forceAligned,
  onLoadingChange,
}: {
  book: BookWithRelations
  width: number
  disableHover?: boolean
  // "auto" keeps the double-cover behavior; "ebook"/"audiobook" force a single
  // cover (falling back to whatever format exists if the chosen one is missing)
  displayMode?: "auto" | "ebook" | "audiobook"
  forceAligned?: boolean
  onLoadingChange?: (loading: boolean) => void
}) {
  const { doubleCoverAlignment } = useUserPreferences()

  const hasAudiobook = book.audiobook !== null
  const hasEbook = book.ebook !== null

  const forceEbook = displayMode === "ebook" && hasEbook
  const forceAudio = displayMode === "audiobook" && hasAudiobook

  const resolvedForceAligned =
    forceAligned ?? (doubleCoverAlignment === "straight" ? true : undefined)

  const scaledWidth = Math.round(width * DPR)
  const scaledHeight = Math.round(width * 1.5 * DPR)
  const scaledAudioSize = Math.round(width * DPR)

  const ebookCoverUrl = getCoverUrl(book.uuid, {
    width: scaledWidth,
    height: scaledHeight,
    audio: false,
    updatedAt: book.updatedAt,
  })

  const audiobookCoverUrl = getCoverUrl(book.uuid, {
    width: scaledAudioSize,
    height: scaledAudioSize,
    audio: true,
    updatedAt: book.updatedAt,
  })

  const imgClassName = cn(
    "object-contain",
    // !disableHover && "transition-transform duration-300 group-hover:scale-105",
  )

  if (forceEbook) {
    return (
      <CoverImage
        src={ebookCoverUrl}
        alt={book.title}
        blurhash={book.ebook?.coverBlurhash}
        type="ebook"
        fallbackColors={book.ebook?.coverColors}
        className="h-full rounded-xs rounded-r-sm shadow-lg"
        imgClassName={imgClassName}
        onLoadingChange={onLoadingChange}
      />
    )
  }

  if (forceAudio) {
    return (
      <CoverImage
        src={audiobookCoverUrl}
        alt={book.title}
        blurhash={book.audiobook?.coverBlurhash}
        type="audiobook"
        fallbackColors={book.audiobook?.coverColors}
        className="aspect-square w-full rounded-sm shadow-lg"
        imgClassName={imgClassName}
        onLoadingChange={onLoadingChange}
      />
    )
  }

  if (isDualFormat(book)) {
    return (
      <BookDoubleCover
        book={book}
        width={width}
        disableHover={disableHover}
        forceAligned={resolvedForceAligned}
        onLoadingChange={onLoadingChange}
      />
    )
  }

  if (hasAudiobook && !hasEbook) {
    return (
      <CoverImage
        src={audiobookCoverUrl}
        alt={book.title}
        blurhash={book.audiobook?.coverBlurhash}
        type="audiobook"
        fallbackColors={book.audiobook?.coverColors}
        className="aspect-square w-full rounded-sm shadow-lg"
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
      className="h-full overflow-clip rounded-sm rounded-r-md shadow-sm transition-[transform_shadow] duration-200 ease-in-out hover:-translate-y-0.5 hover:-rotate-1 hover:shadow-lg"
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
        "from-primary/10 to-primary/5 relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-clip bg-linear-to-br p-4 text-center before:absolute before:inset-0 before:-z-10 before:bg-white before:content-['']",
        className,
      )}
      style={{
        background: primary.solid,
      }}
    >
      {type === "audiobook" ? (
        <icon.HeadphonesFilled
          className="h-12 w-12"
          style={{ color: primary.onColor }}
        />
      ) : (
        <icon.BookFilled
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
