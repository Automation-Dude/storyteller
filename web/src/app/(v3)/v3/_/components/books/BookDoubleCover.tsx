"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { type BookWithRelations } from "@/database/books"
import { getCoverUrl } from "@/store/api"

import { CoverImage } from "./CoverImage"

const DPR =
  typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 3) : 2

const TILE_CLASS =
  "absolute inset-0 m-auto overflow-hidden rounded-lg shadow-md ring-orange-400 group-hover/covers:ring-2"

type Pos = { x: string; scale: number; z: number }
type CoverState = "idle" | "separated" | "audiobook-front"

const STATES: Record<CoverState, { audiobook: Pos; ebook: Pos }> = {
  idle: {
    audiobook: { x: "15%", scale: 1, z: 10 },
    ebook: { x: "-15%", scale: 1, z: 20 },
  },
  separated: {
    audiobook: { x: "18%", scale: 0.8, z: 10 },
    ebook: { x: "-18%", scale: 0.8, z: 20 },
  },
  "audiobook-front": {
    audiobook: { x: "5%", scale: 1.05, z: 20 },
    ebook: { x: "-25%", scale: 0.9, z: 10 },
  },
}

const PEAK = {
  audiobook: { x: "48%", scale: 0.85 },
  ebook: { x: "-48%", scale: 0.85 },
}

const SHUFFLE_MS = 450
const SIMPLE_MS = 220
const PEAK_FRACTION = 0.4

function tx(p: { x: string; scale: number }) {
  return `translateX(${p.x}) scale(${p.scale})`
}

function transformKeyframes(
  target: Pos,
  peak: typeof PEAK.audiobook,
  shuffle: boolean,
): Keyframe[] {
  if (!shuffle) return [{ transform: tx(target) }]
  return [
    { offset: PEAK_FRACTION, transform: tx(peak) },
    { offset: 1, transform: tx(target) },
  ]
}

export function BookDoubleCover({
  book,
  width = 300,
  disableHover = false,
  onLoadingChange,
}: {
  book: BookWithRelations
  width?: number
  disableHover?: boolean
  onLoadingChange?: (loading: boolean) => void
}) {
  const audiobookRef = useRef<HTMLDivElement>(null)
  const ebookRef = useRef<HTMLDivElement>(null)

  const [audioLoading, setAudioLoading] = useState(true)
  const [ebookLoading, setEbookLoading] = useState(true)

  const onLoadingChangeRef = useRef(onLoadingChange)
  onLoadingChangeRef.current = onLoadingChange

  useEffect(() => {
    onLoadingChangeRef.current?.(audioLoading || ebookLoading)
  }, [audioLoading, ebookLoading])

  const stateRef = useRef<CoverState>("idle")
  const audiobookFrontRef = useRef(false)
  const audiobookAnimRef = useRef<Animation | null>(null)
  const ebookAnimRef = useRef<Animation | null>(null)
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  // apply initial transform/z-index once. we don't set these in JSX style
  // because WAAPI's commitStyles() writes to inline style on interruption,
  // we don't want React to mess with it on rerender
  useEffect(() => {
    const ab = audiobookRef.current
    const eb = ebookRef.current
    if (!ab || !eb) return
    ab.style.transform = tx(STATES.idle.audiobook)
    ab.style.zIndex = String(STATES.idle.audiobook.z)
    eb.style.transform = tx(STATES.idle.ebook)
    eb.style.zIndex = String(STATES.idle.ebook.z)
  }, [])

  const transitionTo = useCallback((target: CoverState) => {
    const ab = audiobookRef.current
    const eb = ebookRef.current
    if (!ab || !eb) return
    if (stateRef.current === target) return

    clearTimeout(swapTimerRef.current)
    swapTimerRef.current = undefined

    try {
      audiobookAnimRef.current?.commitStyles()
    } catch {
      // commitStyles can throw if the animation was already canceled / element detached
    }
    try {
      ebookAnimRef.current?.commitStyles()
    } catch {
      // pass
    }
    audiobookAnimRef.current?.cancel()
    ebookAnimRef.current?.cancel()

    const targetIsFront = target === "audiobook-front"
    const shuffle = targetIsFront !== audiobookFrontRef.current
    const duration = shuffle ? SHUFFLE_MS : SIMPLE_MS

    const tgtAudio = STATES[target].audiobook
    const tgtEbook = STATES[target].ebook

    audiobookAnimRef.current = ab.animate(
      transformKeyframes(tgtAudio, PEAK.audiobook, shuffle),
      { duration, easing: "ease-out", fill: "forwards" },
    )
    ebookAnimRef.current = eb.animate(
      transformKeyframes(tgtEbook, PEAK.ebook, shuffle),
      { duration, easing: "ease-out", fill: "forwards" },
    )

    if (shuffle) {
      // flip z at peak spread, when cards are fully apart and the swap is invisible
      swapTimerRef.current = setTimeout(() => {
        ab.style.zIndex = String(tgtAudio.z)
        eb.style.zIndex = String(tgtEbook.z)
        audiobookFrontRef.current = targetIsFront
        swapTimerRef.current = undefined
      }, duration * PEAK_FRACTION)
    } else {
      ab.style.zIndex = String(tgtAudio.z)
      eb.style.zIndex = String(tgtEbook.z)
    }

    stateRef.current = target
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(swapTimerRef.current)
      audiobookAnimRef.current?.cancel()
      ebookAnimRef.current?.cancel()
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

  const fallbackColors = book.ebook?.coverColors ?? book.readaloud?.coverColors

  return (
    <div
      className="group/covers relative h-full w-full"
      onPointerEnter={() => {
        if (disableHover) return
        if (stateRef.current === "idle") transitionTo("separated")
      }}
      onPointerLeave={() => {
        if (disableHover) return
        transitionTo("idle")
      }}
    >
      <div
        ref={audiobookRef}
        className={TILE_CLASS}
        style={{ width: "82%", aspectRatio: "1 / 1" }}
        onPointerEnter={() => {
          if (disableHover) return
          transitionTo("audiobook-front")
        }}
        onPointerLeave={(e) => {
          if (disableHover) return
          // if we're still inside the cover-stack, fall back to separated
          const next = e.relatedTarget as Node | null
          if (next && e.currentTarget.parentElement?.contains(next)) {
            transitionTo("separated")
          }
        }}
      >
        <CoverImage
          src={audiobookUrl}
          alt={book.title}
          ariaHidden
          blurhash={book.audiobook?.coverBlurhash}
          type="audiobook"
          fallbackColors={fallbackColors}
          className="h-full w-full"
          onLoadingChange={setAudioLoading}
        />
      </div>
      <div
        ref={ebookRef}
        className={TILE_CLASS}
        style={{ width: "82%", aspectRatio: "2 / 3" }}
      >
        <CoverImage
          src={ebookUrl}
          alt={book.title}
          blurhash={book.ebook?.coverBlurhash}
          type="ebook"
          fallbackColors={fallbackColors}
          className="h-full w-full"
          onLoadingChange={setEbookLoading}
        />
      </div>
    </div>
  )
}
