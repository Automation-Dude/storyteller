import { getCoverUrl } from "@/api/api"
import { BookWithRelations } from "@/api/models/books"
import { motion, useAnimationControls } from "framer-motion"
import { useRef } from "react"

type HoverState = "idle" | "separated" | "audiobook-front"

interface Props {
  book: BookWithRelations
  ebookWidth?: number
  ebookHeight?: number
  audiobookSize?: number
  defaultFront?: "ebook" | "audiobook"
}

const TRANSITION = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
}

export function BookDoubleCover({
  book,
  ebookWidth = 147,
  ebookHeight = 220,
  audiobookSize = 147,
  defaultFront = "ebook",
}: Props) {
  const hoverStateRef = useRef<HoverState>("idle")

  const ebookControls = useAnimationControls()
  const audiobookControls = useAnimationControls()

  const containerWidth = ebookWidth * 1.4
  const containerHeight = ebookHeight

  // position values
  const ebookIdleX = defaultFront === "ebook" ? 0 : ebookWidth * 0.15
  const audiobookIdleX = defaultFront === "ebook" ? ebookWidth * 0.15 : 0
  const ebookSeparatedX = -ebookWidth * 0.05
  const audiobookSeparatedX = ebookWidth * 0.05
  const ebookSwappingX = ebookSeparatedX - ebookWidth * 0.2
  const audiobookSwappingX = audiobookSeparatedX + ebookWidth * 0.2

  // z-index values
  const ebookFrontZ = 20
  const audiobookFrontZ = 20
  const ebookBackZ = 10
  const audiobookBackZ = 10

  const animateToIdle = async () => {
    const previousState = hoverStateRef.current
    hoverStateRef.current = "idle"

    if (previousState === "audiobook-front") {
      // first move covers to separated position (audiobook still in front visually)
      await Promise.all([
        ebookControls.start({
          x: ebookSwappingX,
          scale: 0.8,
          transition: TRANSITION,
        }),
        audiobookControls.start({
          x: audiobookSwappingX,
          scale: 0.7,
          transition: TRANSITION,
        }),
      ])

      if (hoverStateRef.current !== "idle") return

      // now swap z-index (instant, no animation needed since they're separated)
      ebookControls.set({ zIndex: ebookFrontZ })
      audiobookControls.set({ zIndex: audiobookBackZ })
    }

    if (hoverStateRef.current !== "idle") return

    // animate to idle position
    await Promise.all([
      ebookControls.start({
        x: ebookIdleX,
        scale: 1,
        transition: TRANSITION,
      }),
      audiobookControls.start({
        x: audiobookIdleX,
        scale: 0.85,
        transition: TRANSITION,
      }),
    ])
  }

  const animateToSeparated = async () => {
    await Promise.all([
      ebookControls.start({
        x: ebookSeparatedX,
        scale: 0.8,
        transition: { ...TRANSITION, duration: 0.1 },
      }),
      audiobookControls.start({
        x: audiobookSeparatedX,
        scale: 0.7,
        transition: { ...TRANSITION, duration: 0.1 },
      }),
    ])
    hoverStateRef.current = "separated"
  }

  const animateToAudiobookFront = async () => {
    const previousState = hoverStateRef.current

    hoverStateRef.current = "audiobook-front"
    // if not already separated, first separate
    if (previousState === "idle") {
      await Promise.all([
        ebookControls.start({
          x: ebookSeparatedX,
          scale: 0.8,
          transition: { ...TRANSITION, duration: 0.1 },
        }),
        audiobookControls.start({
          x: audiobookSeparatedX,
          scale: 0.7,
          transition: { ...TRANSITION, duration: 0.1 },
        }),
      ])

      if (hoverStateRef.current !== "audiobook-front") return
    }

    // swap z-index (instant, covers are separated so no visual overlap)

    if (hoverStateRef.current !== "audiobook-front") return

    await Promise.all([
      ebookControls.start({
        x: ebookSwappingX,
        // scale: 0.9,
        transition: { ease: "easeOut", duration: 0.3 },
      }),
      audiobookControls.start({
        x: audiobookSwappingX,
        // scale: 0.9,
        transition: { ease: "easeOut", duration: 0.3 },
      }),
    ])
    ebookControls.set({ zIndex: ebookBackZ })
    audiobookControls.set({ zIndex: audiobookFrontZ })

    // move audiobook to front position
    await Promise.all([
      ebookControls.start({
        x: ebookIdleX,
        scale: 0.8,
        transition: { ease: "easeIn", duration: 0.3 },
      }),
      audiobookControls.start({
        x: audiobookIdleX,
        scale: 0.8,
        transition: { ease: "easeIn", duration: 0.3 },
      }),
    ])
  }

  const handleGroupHoverStart = () => {
    if (hoverStateRef.current === "idle") {
      void animateToSeparated()
    }
  }

  const handleGroupHoverEnd = () => {
    void animateToIdle()
  }

  const handleAudiobookHoverStart = () => {
    if (
      hoverStateRef.current === "separated" ||
      hoverStateRef.current === "idle"
    ) {
      void animateToAudiobookFront()
    }
  }

  const initialEbookZ = defaultFront === "ebook" ? ebookFrontZ : ebookBackZ
  const initialAudiobookZ =
    defaultFront === "ebook" ? audiobookBackZ : audiobookFrontZ

  return (
    <motion.div
      className="relative"
      style={{
        width: containerWidth,
        height: containerHeight,
      }}
      onHoverStart={handleGroupHoverStart}
      onHoverEnd={handleGroupHoverEnd}
    >
      <motion.img
        src={getCoverUrl(book.uuid, {
          width: audiobookSize,
          height: audiobookSize,
          audio: true,
        })}
        alt=""
        aria-hidden
        height={audiobookSize}
        width={audiobookSize}
        className="absolute rounded-md shadow-md"
        style={{
          top: (containerHeight - audiobookSize) / 2,
          right: 0,
        }}
        initial={{
          x: audiobookIdleX,
          scale: 0.85,
          zIndex: initialAudiobookZ,
        }}
        animate={audiobookControls}
        onHoverStart={handleAudiobookHoverStart}
      />
      <motion.img
        src={getCoverUrl(book.uuid, {
          width: ebookWidth,
          height: ebookHeight,
        })}
        alt={book.title}
        height={ebookHeight}
        width={ebookWidth}
        className="absolute left-0 top-0 rounded-md shadow-md"
        initial={{
          x: ebookIdleX,
          scale: 1,
          zIndex: initialEbookZ,
        }}
        animate={ebookControls}
      />
    </motion.div>
  )
}
