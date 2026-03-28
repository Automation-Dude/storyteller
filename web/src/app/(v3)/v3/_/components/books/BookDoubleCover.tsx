"use client"

import { motion, useAnimationControls, useMotionValue } from "framer-motion"
import { useCallback, useEffect, useRef, useState } from "react"

import { type BookWithRelations } from "@/database/books"
import { getCoverUrl } from "@/store/api"

import { FallbackCover } from "./BookCover"

type CoverState = "idle" | "separated" | "audiobook-front"

const SPRING = { type: "spring" as const, stiffness: 400, damping: 30 }

const DPR =
  typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 3) : 2

interface Props {
  book: BookWithRelations
  width?: number
  disableHover?: boolean
}

const IDLE = {
  ebook: { x: "-10%", scale: 1 },
  audiobook: { x: "10%", scale: 1 },
}

const SEPARATED = {
  ebook: { x: "-14%", scale: 0.78 },
  audiobook: { x: "14%", scale: 0.78 },
}

const PEAK = {
  ebook: { x: "-40%", scale: 0.8 },
  audiobook: { x: "40%", scale: 0.88 },
}

const AUDIOBOOK_FRONT = {
  ebook: { x: "-10%", scale: 1 },
  audiobook: { x: "10%", scale: 1 },
}

export function BookDoubleCover({
  book,
  width = 300,
  disableHover = false,
}: Props) {
  const ebookControls = useAnimationControls()
  const audiobookControls = useAnimationControls()

  const stateRef = useRef<CoverState>("idle")
  const genRef = useRef(0)

  const [zState, setZState] = useState<"ebook-front" | "audiobook-front">(
    "ebook-front",
  )

  const transitionTo = useCallback(
    async (target: CoverState) => {
      const gen = ++genRef.current
      const prev = stateRef.current
      const stale = () => genRef.current !== gen

      if (prev === target) return
      stateRef.current = target

      if (target === "separated") {
        await Promise.all([
          ebookControls.start({ ...SEPARATED.ebook, transition: SPRING }),
          audiobookControls.start({
            ...SEPARATED.audiobook,
            transition: SPRING,
          }),
        ])

        return
      }

      if (target === "audiobook-front") {
        await Promise.all([
          ebookControls.start({
            ...PEAK.ebook,
            transition: {
              type: "tween",
              duration: 0.2,
              ease: "easeIn",
            },
          }),
          audiobookControls.start({
            ...PEAK.audiobook,
            transition: {
              type: "tween",
              duration: 0.2,
              ease: "easeIn",
            },
          }),
        ])
        if (stale()) return

        setZState("audiobook-front")

        await Promise.all([
          ebookControls.start({
            ...AUDIOBOOK_FRONT.ebook,
            transition: {
              type: "tween",
              duration: 0.3,
              ease: "easeOut",
            },
          }),
          audiobookControls.start({
            ...AUDIOBOOK_FRONT.audiobook,
            transition: {
              type: "tween",
              duration: 0.3,
              ease: "easeOut",
            },
          }),
        ])

        return
      }

      if (prev === "audiobook-front") {
        await Promise.all([
          ebookControls.start({
            ...PEAK.ebook,
            transition: {
              type: "tween",
              duration: 0.3,
              ease: "easeOut",
            },
          }),
          audiobookControls.start({
            ...PEAK.audiobook,
            transition: {
              type: "tween",
              duration: 0.3,
              ease: "easeOut",
            },
          }),
        ])
        if (stale()) return

        setZState("ebook-front")
      }

      await Promise.all([
        ebookControls.start({
          ...IDLE.ebook,
          transition: {
            type: "tween",
            duration: 0.3,
            ease: "easeOut",
          },
        }),
        audiobookControls.start({
          ...IDLE.audiobook,
          transition: {
            type: "tween",
            duration: 0.3,
            ease: "easeOut",
          },
        }),
      ])
    },
    [ebookControls, audiobookControls],
  )

  const [ebookError, setEbookError] = useState(false)
  const [audiobookError, setAudiobookError] = useState(false)

  const ebookZ = useMotionValue(20)
  const audiobookZ = useMotionValue(10)

  useEffect(() => {
    if (zState === "ebook-front") {
      ebookZ.set(20)
      audiobookZ.set(10)
    } else {
      ebookZ.set(10)
      audiobookZ.set(20)
    }
  }, [zState, ebookZ, audiobookZ])

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

  return (
    <div
      className="group/covers relative h-full w-full"
      onMouseEnter={() => {
        if (disableHover) return

        if (stateRef.current === "idle") {
          void transitionTo("separated")
        }
      }}
      onMouseLeave={() => {
        if (disableHover) return
        void transitionTo("idle")
      }}
    >
      {!audiobookError ? (
        <motion.img
          src={audiobookUrl}
          alt=""
          aria-hidden
          loading="lazy"
          className="absolute inset-0 m-auto rounded-lg object-cover shadow-md ring-orange-400 transition-shadow group-hover/covers:ring-2"
          style={{
            width: "82%",
            aspectRatio: "1 / 1",
            zIndex: audiobookZ,
          }}
          initial={IDLE.audiobook}
          animate={audiobookControls}
          onPointerEnter={() => {
            if (disableHover) return

            const current = stateRef.current
            if (current === "separated" || current === "idle") {
              void transitionTo("audiobook-front")
            }
          }}
          onError={() => {
            setAudiobookError(true)
          }}
        />
      ) : (
        <motion.div
          className="absolute inset-0 m-auto rounded-lg object-cover shadow-md ring-orange-400 transition-shadow group-hover/covers:ring-2"
          style={{
            width: "82%",
            aspectRatio: "1 / 1",
            zIndex: audiobookZ,
          }}
          initial={IDLE.audiobook}
          animate={audiobookControls}
          onPointerEnter={() => {
            if (disableHover) return

            const current = stateRef.current
            if (current === "separated" || current === "idle") {
              void transitionTo("audiobook-front")
            }
          }}
        >
          <FallbackCover title={book.title} type="audiobook" />
        </motion.div>
      )}

      {!ebookError ? (
        <motion.img
          src={ebookUrl}
          alt={book.title}
          loading="lazy"
          className="absolute inset-0 m-auto rounded-lg object-cover shadow-md ring-orange-400 transition-shadow group-hover/covers:ring-2"
          style={{
            width: "82%",
            aspectRatio: "2 / 3",
            zIndex: ebookZ,
          }}
          initial={IDLE.ebook}
          animate={ebookControls}
          onError={() => {
            setEbookError(true)
          }}
        />
      ) : (
        <motion.div
          className="absolute inset-0 m-auto rounded-lg object-cover shadow-md ring-orange-400 transition-shadow group-hover/covers:ring-2"
          initial={IDLE.ebook}
          animate={ebookControls}
          style={{
            width: "82%",
            aspectRatio: "2 / 3",
            zIndex: ebookZ,
          }}
        >
          <FallbackCover title={book.title} type="ebook" />
        </motion.div>
      )}
    </div>
  )
}
