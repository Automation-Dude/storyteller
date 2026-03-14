import { IconBook } from "@tabler/icons-react"
import { useState } from "react"

import { type BookWithRelations } from "@/database/books"
import { getCoverUrl } from "@/store/api"

// request 2x resolution for sharp rendering on retina/high-dpi screens
const DPR = typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 3) : 2

export function BookCover({
  book,
  width,
}: {
  book: BookWithRelations
  width: number
}) {
  const [audiobookError, setAudiobookError] = useState(false)
  const [ebookError, setEbookError] = useState(false)

  const hasAudiobook = book.audiobook !== null
  const hasEbook = book.ebook !== null
  const isSynced =
    book.readaloud !== null && book.readaloud.status === "ALIGNED"

  const scaledWidth = Math.round(width * DPR)
  const scaledHeight = Math.round(width * 1.5 * DPR)
  const scaledAudioSize = Math.round(width * DPR)

  const audiobookCoverUrl = getCoverUrl(book.uuid, {
    width: scaledAudioSize,
    height: scaledAudioSize,
    audio: true,
    updatedAt: book.audiobook?.updatedAt ?? book.updatedAt,
  })

  const ebookCoverUrl = getCoverUrl(book.uuid, {
    width: scaledWidth,
    height: scaledHeight,
    audio: false,
    updatedAt: book.ebook?.updatedAt ?? book.updatedAt,
  })

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
                className="h-full w-full rounded-md object-cover"
              />
            </div>
          </div>
        ) : (
          <div className="bg-muted absolute top-1 left-1 h-[80%] w-[80%] rounded-md" />
        )}

        <div className="absolute right-0 bottom-0 h-full w-full overflow-hidden rounded-lg transition-transform duration-300 group-hover:scale-105">
          {!audiobookError && (
            <div className="absolute top-0 left-0 h-full w-full overflow-hidden rounded-lg bg-linear-to-t from-black/20 to-transparent shadow-lg" />
          )}
          {!ebookError ? (
            <img
              src={ebookCoverUrl}
              alt={book.title}
              height={width * 1.5}
              width={width}
              loading="lazy"
              onError={() => {
                setEbookError(true)
              }}
              className="h-full w-full rounded-lg object-cover"
            />
          ) : (
            <FallbackCover title={book.title} />
          )}
        </div>
      </div>
    )
  }

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
              className="h-full w-full rounded-lg object-cover"
            />
          ) : (
            <FallbackCover title={book.title} />
          )}
        </div>
      </div>
    )
  }

  if (!ebookError) {
    return (
      <img
        src={ebookCoverUrl}
        alt={book.title}
        height={width * 1.5}
        width={width}
        loading="lazy"
        onError={() => {
          setEbookError(true)
        }}
        className="h-full w-full rounded-lg object-cover"
      />
    )
  }

  return <FallbackCover title={book.title} />
}

export function FallbackCover({ title }: { title: string }) {
  return (
    <div className="from-primary/10 to-primary/5 flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg bg-gradient-to-br p-4 text-center">
      <IconBook className="text-muted-foreground/50 h-12 w-12" />
      <span className="text-muted-foreground line-clamp-3 text-sm font-medium">
        {title}
      </span>
    </div>
  )
}
