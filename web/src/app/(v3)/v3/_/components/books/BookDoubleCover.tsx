"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { type BookWithRelations } from "@/database/books"
import { getCoverUrl } from "@/store/api"

import { BlurhashCanvas } from "./BlurhashCanvas"
import { FallbackCover } from "./BookCover"

type CoverState = "idle" | "separated" | "audiobook-front"

const DPR =
  typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 3) : 2

const T_SPRING =
  "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), box-shadow 0.15s ease"
const T_IN = "transform 0.2s ease-in, box-shadow 0.15s ease"
const T_OUT = "transform 0.3s ease-out, box-shadow 0.15s ease"

const COVER_BASE =
  "absolute inset-0 m-auto overflow-hidden rounded-lg shadow-md ring-orange-400 group-hover/covers:ring-2"

type Pos = { x: string; scale: number; z: number }

function tx(x: string, scale: number) {
  return `translateX(${x}) scale(${scale})`
}

export function BookDoubleCover({
  book,
  width = 300,
  disableHover = false,
}: {
  book: BookWithRelations
  width?: number
  disableHover?: boolean
}) {
  const stateRef = useRef<CoverState>("idle")
  const zSwappedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const ebookRef = useRef<HTMLDivElement>(null)
  const audiobookRef = useRef<HTMLDivElement>(null)

  const [ebookError, setEbookError] = useState(false)
  const [audiobookError, setAudiobookError] = useState(false)

  const apply = useCallback(
    (transition: string, ebook: Pos, audiobook: Pos) => {
      const eb = ebookRef.current
      const ab = audiobookRef.current
      if (!eb || !ab) return

      eb.style.transition = transition
      eb.style.transform = tx(ebook.x, ebook.scale)
      eb.style.zIndex = String(ebook.z)

      ab.style.transition = transition
      ab.style.transform = tx(audiobook.x, audiobook.scale)
      ab.style.zIndex = String(audiobook.z)
    },
    [],
  )

  const transitionTo = useCallback(
    (target: CoverState) => {
      clearTimeout(timerRef.current)

      const prev = stateRef.current
      if (prev === target) return

      stateRef.current = target

      const ebZ = zSwappedRef.current ? 10 : 20
      const abZ = zSwappedRef.current ? 20 : 10

      if (target === "separated") {
        apply(
          T_SPRING,
          { x: "-18%", scale: 0.8, z: ebZ },
          { x: "18%", scale: 0.8, z: abZ },
        )

        return
      }

      if (target === "audiobook-front") {
        // phase 1: spread apart, keep current z-order
        apply(
          T_IN,
          { x: "-50%", scale: 0.9, z: ebZ },
          { x: "50%", scale: 0.9, z: abZ },
        )

        // phase 2: swap z at peak spread (invisible), then settle
        timerRef.current = setTimeout(() => {
          zSwappedRef.current = true

          apply(
            T_OUT,
            { x: "-15%", scale: 1, z: 10 },
            { x: "15%", scale: 1, z: 20 },
          )
        }, 200)

        return
      }

      // target === "idle"
      if (zSwappedRef.current) {
        // phase 1: spread apart with current (swapped) z-order
        apply(
          T_OUT,
          { x: "-50%", scale: 0.9, z: 10 },
          { x: "50%", scale: 0.9, z: 20 },
        )

        // phase 2: swap z back at peak spread, then settle to idle
        timerRef.current = setTimeout(() => {
          zSwappedRef.current = false

          apply(
            T_OUT,
            { x: "-15%", scale: 1, z: 20 },
            { x: "15%", scale: 1, z: 10 },
          )
        }, 300)

        return
      }

      apply(
        T_SPRING,
        { x: "-15%", scale: 1, z: 20 },
        { x: "15%", scale: 1, z: 10 },
      )
    },
    [apply],
  )

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current)
    }
  }, [])

  const scaledWidth = Math.round(width * DPR)
  const scaledHeight = Math.round(width * 1.5 * DPR)

  const ebookUrl = getCoverUrl(book.uuid, {
    width: scaledWidth,
    height: scaledHeight,
    audio: false,
    updatedAt: book.ebook?.updatedAt ?? book.updatedAt,
  })

  const audiobookUrl = getCoverUrl(book.uuid, {
    width: scaledWidth,
    height: scaledWidth,
    audio: true,
    updatedAt: book.audiobook?.updatedAt ?? book.updatedAt,
  })

  const ebookBlurhash = book.ebook?.coverBlurhash
  const audiobookBlurhash = book.audiobook?.coverBlurhash

  return (
    <div
      className="group/covers relative h-full w-full"
      onMouseEnter={() => {
        if (disableHover) return

        if (stateRef.current === "idle") {
          transitionTo("separated")
        }
      }}
      onMouseLeave={() => {
        if (disableHover) return
        transitionTo("idle")
      }}
    >
      <div
        ref={audiobookRef}
        className={COVER_BASE}
        style={{
          width: "82%",
          aspectRatio: "1 / 1",
          zIndex: 10,
          transform: tx("15%", 1),
          transition: T_SPRING,
        }}
        onPointerEnter={() => {
          if (disableHover) return

          const current = stateRef.current
          if (current === "separated" || current === "idle") {
            transitionTo("audiobook-front")
          }
        }}
      >
        <BlurhashCanvas blurhash={audiobookBlurhash} />

        {!audiobookError ? (
          <img
            src={audiobookUrl}
            alt=""
            aria-hidden
            loading="lazy"
            onError={() => {
              setAudiobookError(true)
            }}
            className="relative z-10 h-full w-full object-cover"
          />
        ) : !audiobookBlurhash ? (
          <FallbackCover title={book.title} type="audiobook" />
        ) : null}
      </div>

      <div
        ref={ebookRef}
        className={COVER_BASE}
        style={{
          width: "82%",
          aspectRatio: "2 / 3",
          zIndex: 20,
          transform: tx("-15%", 1),
          transition: T_SPRING,
        }}
      >
        <BlurhashCanvas blurhash={ebookBlurhash} />

        {!ebookError ? (
          <img
            src={ebookUrl}
            alt={book.title}
            loading="lazy"
            onError={() => {
              setEbookError(true)
            }}
            className="relative z-10 h-full w-full object-cover"
          />
        ) : !ebookBlurhash ? (
          <FallbackCover title={book.title} type="ebook" />
        ) : null}
      </div>
    </div>
  )
}
