import {
  IconBook,
  IconBookFilled,
  IconHeadphonesFilled,
} from "@tabler/icons-react"
import { motion } from "framer-motion"
import { useState } from "react"

import { type BookWithRelations } from "@/database/books"
import { getCoverUrl } from "@/store/api"

import { BookDoubleCover } from "./BookDoubleCover"

// request 2x resolution for sharp rendering on retina/high-dpi screens
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
}: {
  book: BookWithRelations
  width: number
}) {
  const [audiobookError, setAudiobookError] = useState(false)
  const [ebookError, setEbookError] = useState(false)

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
    return <BookDoubleCover book={book} width={width} />
  }

  if (hasAudiobook && !hasEbook) {
    return (
      <div className="p-3">
        <div className="aspect-square w-full overflow-hidden rounded-lg shadow-lg transition-transform duration-300 group-hover:scale-105">
          {!audiobookError ? (
            <motion.img
              src={audiobookCoverUrl}
              alt={book.title}
              loading="lazy"
              onError={() => {
                setAudiobookError(true)
              }}
              className="h-full w-full rounded-lg object-cover"
            />
          ) : (
            <FallbackCover title={book.title} type="audiobook" />
          )}
        </div>
      </div>
    )
  }

  if (!ebookError) {
    return (
      <motion.img
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

  return <FallbackCover title={book.title} type="ebook" />
}

export function FallbackCover({
  title,
  type,
}: {
  title: string
  type: "audiobook" | "ebook"
}) {
  return (
    <motion.div className="from-primary/10 to-primary/5 relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-clip rounded-lg bg-gradient-to-br p-4 text-center before:absolute before:inset-0 before:-z-10 before:bg-white before:content-['']">
      {type === "audiobook" ? (
        <IconHeadphonesFilled className="text-muted-foreground/50 h-12 w-12" />
      ) : (
        <IconBookFilled className="text-muted-foreground/50 h-12 w-12" />
      )}
      <span className="text-muted-foreground line-clamp-2 text-sm font-medium">
        {title}
      </span>
    </motion.div>
  )
}
