import { type Variants, motion, useAnimationControls } from "framer-motion"
import { useRef, useState } from "react"

import { getCoverUrl } from "@/api/api"
import { type BookWithRelations } from "@/api/models/books"

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
  const ebookControls = useAnimationControls()
  const audiobookControls = useAnimationControls()

  const containerWidth = ebookWidth * 1.4
  const containerHeight = ebookHeight

  // position values
  const [groupHover, setGroupHover] = useState(false)
  const [audiobookHover, setAudiobookHover] = useState(false)

  const audiobookVariants = {
    idle: {
      transform: [
        null,
        "translate3d(60px, 0, 0px)",
        "translate3d(0px, 0, -100px)",
      ],
    },
    zoomedOut: {
      transform: "translate3d(20px, 0, -100px)",
    },
    "audiobook-front": {
      transform: [
        null,
        "translate3d(60px, 0, -100px)",
        "translate3d(0px, 0, 100px)",
      ],
    },
  } as const satisfies Variants

  const ebookVariants = {
    idle: {
      transform: [null, "translate3d(-60px, 0, 0px)", "translate3d(0, 0, 0px)"],
    },
    zoomedOut: {
      transform: "translate3d(-20px, 0, 0px)",
    },
    "ebook-front": {
      transform: [
        null,
        "translate3d(-60px, 0, 0px)",
        "translate3d(0, 0, -100px)",
      ],
    },
  } as const satisfies Variants

  console.log("groupHover", groupHover)
  console.log("audiobookHover", audiobookHover)
  return (
    <motion.div
      className="relative z-10"
      style={{
        width: containerWidth,

        height: containerHeight,
        transformStyle: "preserve-3d",
        perspective: "2000px",
        backgroundColor: "red",
      }}
      onHoverStart={() => {
        setGroupHover(true)
      }}
      onHoverEnd={() => {
        setGroupHover(false)
        setAudiobookHover(false)
      }}
    >
      <motion.img
        variants={audiobookVariants}
        src={getCoverUrl(book.uuid, {
          width: audiobookSize,
          height: audiobookSize,
          audio: true,
        })}
        alt=""
        aria-hidden
        height={audiobookSize}
        width={audiobookSize}
        className="pointer-events-none absolute rounded-md shadow-md"
        style={{
          top: (containerHeight - audiobookSize) / 2,
          right: 0,
        }}
        initial={"idle"}
        animate={
          audiobookHover
            ? "audiobook-front"
            : groupHover
              ? "zoomedOut"
              : undefined
        }
        onPointerEnter={() => {
          setAudiobookHover(true)
          setGroupHover(true)
        }}
        // onHoverStart={() => {
        //   setAudiobookHover(true)
        //   setGroupHover(true)
        // }}
      />
      <motion.img
        src={getCoverUrl(book.uuid, {
          width: ebookWidth,
          height: ebookHeight,
        })}
        alt={book.title}
        variants={ebookVariants}
        height={ebookHeight}
        width={ebookWidth}
        className="absolute top-0 left-0 rounded-md shadow-md"
        initial={"idle"}
        animate={
          audiobookHover ? "ebook-front" : groupHover ? "zoomedOut" : undefined
        }
      />
    </motion.div>
  )
}
