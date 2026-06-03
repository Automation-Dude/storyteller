"use client"

import { IconArrowsMaximize } from "@tabler/icons-react"
import { type PanInfo, motion, useSpring } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"

import { Dialog, DialogContent, DialogTitle } from "@v3/_/components/ui/dialog"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { type SpineFit, fitSpine } from "@v3/_/lib/spineFit"

import { type BookWithRelations } from "@/database/books"
import { getCoverUrl } from "@/store/api"

import { isDualFormat } from "./BookCover"
import {
  type CoverColor,
  useCoverColors,
} from "./BookDetails/sections/useCoverColors"
import { CoverImage } from "./CoverImage"

const DPR =
  typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 3) : 2

const MIN_THICKNESS = 24
const MAX_THICKNESS = 80

// reference "long" values per metric, used to normalise thickness
const DURATION_MAX = 108_000 // ~30h in seconds
const PAGES_MAX = 1_000
const FILE_SIZE_MAX = 50_000_000 // 50mb

// paper page-stack texture for the head / tail / fore-edge of a book
const PAGE_EDGE_V =
  "repeating-linear-gradient(to right, #f3ecda 0 1px, #d4c4a0 1px 2.5px)"
const PAGE_EDGE_H =
  "repeating-linear-gradient(to bottom, #f3ecda 0 1px, #d4c4a0 1px 2.5px)"
// glossy plastic edge for a cd / jewel case
const CD_EDGE_V =
  "linear-gradient(to right, rgba(255,255,255,0.6), rgba(170,176,188,0.35) 45%, rgba(90,96,108,0.5))"
const CD_EDGE_H =
  "linear-gradient(to bottom, rgba(255,255,255,0.6), rgba(170,176,188,0.35) 45%, rgba(90,96,108,0.5))"

// audiobook cd case: one disc per ~6h of audio, capped, each disc only adds a
// little depth so a long listen reads as a fat multi-disc case (not a brick)
const HOURS_PER_DISC = 6
const MAX_DISCS = 6
const CD_BASE_THICKNESS = 22
const CD_PER_DISC = 7

// spine typography, shared with the pretext fitter so measurement matches render
const SPINE_TITLE_SIZE = 14
const SPINE_AUTHOR_SIZE = 11
const SPINE_TITLE_FONT = `${SPINE_TITLE_SIZE}px Georgia, "Times New Roman", serif`
const SPINE_AUTHOR_FONT = `${SPINE_AUTHOR_SIZE}px ui-sans-serif, system-ui, sans-serif`

// what to print along the spine
export type SpineInfo = "title" | "pages" | "duration"

// preset angles cycled through on tap
const VIEWS = [
  { y: 0, x: 0 }, // cover
  { y: -30, x: 0 }, // spine
  { y: 26, x: 8 }, // fore-edge / pages
  { y: 180, x: 0 }, // back
] as const

const SPRING = { stiffness: 140, damping: 18, mass: 0.6 }
const DRAG_SENSITIVITY = 0.4

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

function pageCount(book: BookWithRelations): number | null {
  return book.ebook?.pageCount ?? book.readaloud?.pageCount ?? book.pageCount
}

function duration(book: BookWithRelations): number | null {
  return book.audiobook?.duration ?? book.readaloud?.duration ?? null
}

function publicationYear(book: BookWithRelations): number | null {
  if (!book.publicationDate) return null
  const year = new Date(book.publicationDate).getFullYear()
  return Number.isFinite(year) ? year : null
}

// the best signal we have for how long a book is, by format
function lengthMetric(
  book: BookWithRelations,
): { value: number; max: number } | null {
  const audioDuration = duration(book)
  if (audioDuration) return { value: audioDuration, max: DURATION_MAX }

  const pages = pageCount(book)
  if (pages) return { value: pages, max: PAGES_MAX }

  const fileSize =
    book.ebook?.fileSize ?? book.audiobook?.fileSize ?? book.readaloud?.fileSize
  if (fileSize) return { value: fileSize, max: FILE_SIZE_MAX }

  return null
}

export function getBookThickness(book: BookWithRelations): number {
  const metric = lengthMetric(book)
  if (!metric) return Math.round((MIN_THICKNESS + MAX_THICKNESS) / 2)

  // sqrt keeps the very long books from dwarfing everything else
  const norm = clamp(Math.sqrt(metric.value) / Math.sqrt(metric.max), 0, 1)
  return Math.round(MIN_THICKNESS + norm * (MAX_THICKNESS - MIN_THICKNESS))
}

// how many discs an audiobook holds, for the cd-case depth + the visible stack
function discCount(book: BookWithRelations): number {
  const total = duration(book)
  if (!total) return 1
  return clamp(Math.ceil(total / 3600 / HOURS_PER_DISC), 1, MAX_DISCS)
}

function cdThickness(discs: number): number {
  return CD_BASE_THICKNESS + (discs - 1) * CD_PER_DISC
}

// silver discs floating inside the (clear) jewel case, revealed when it turns
function DiscStack({
  count,
  size,
  thickness,
}: {
  count: number
  size: number
  thickness: number
}) {
  const diameter = Math.round(size * 0.82)
  const inset = 7
  const span = Math.max(0, thickness - inset * 2)

  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const z = count <= 1 ? 0 : -span / 2 + (span / (count - 1)) * i
        return (
          <div
            key={i}
            className="pointer-events-none absolute top-1/2 left-1/2 rounded-full"
            style={{
              width: diameter,
              height: diameter,
              transform: `translate(-50%, -50%) translateZ(${z}px)`,
              background:
                "radial-gradient(circle at 50% 38%, #fdfdfe 4%, #d9dde4 30%, #aeb4bf 46%, #e9ecf1 56%, #b7bdc8 72%, #9097a3 88%)",
              boxShadow:
                "inset 0 0 0 1px rgba(255,255,255,0.45), 0 1px 6px rgba(0,0,0,0.18)",
            }}
          >
            <div
              className="absolute top-1/2 left-1/2 rounded-full"
              style={{
                width: diameter * 0.17,
                height: diameter * 0.17,
                transform: "translate(-50%, -50%)",
                background: "rgba(255,255,255,0.9)",
                boxShadow: "inset 0 0 0 1px rgba(120,126,138,0.6)",
              }}
            />
          </div>
        )
      })}
    </>
  )
}

function spineLabel(
  book: BookWithRelations,
  info: SpineInfo,
): { left: string; right: string } {
  if (info === "pages") {
    const pages = pageCount(book)
    return { left: "", right: pages ? `${pages} pages` : "—" }
  }
  if (info === "duration") {
    const total = duration(book)
    return { left: "", right: total ? formatDuration(total) : "—" }
  }
  return {
    left: book.authors.map((author) => author.name).join(", "),
    right: book.title,
  }
}

function CoverFace({
  book,
  audio,
  width,
  height,
}: {
  book: BookWithRelations
  audio: boolean
  width: number
  height: number
}) {
  const format = audio ? book.audiobook : book.ebook
  const url = getCoverUrl(book.uuid, {
    width: Math.round(width * DPR),
    height: Math.round(height * DPR),
    audio,
    updatedAt: format?.updatedAt ?? book.updatedAt,
  })

  return (
    <CoverImage
      src={url}
      alt={book.title}
      ariaHidden
      blurhash={format?.coverBlurhash}
      type={audio ? "audiobook" : "ebook"}
      fallbackColors={format?.coverColors}
      className="h-full w-full"
      imgClassName="h-full w-full object-cover"
    />
  )
}

// the back of the book: blurb with a drop cap, year tucked in the corner.
// everything scales off the rendered width so the blurb reads well both small
// (in the panel) and large (fullscreen), and the drop cap uses em so it tracks
function DescriptionBack({
  book,
  primary,
  width,
}: {
  book: BookWithRelations
  primary: CoverColor
  width: number
}) {
  const year = publicationYear(book)
  const text = book.description
    ?.replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const fontSize = clamp(Math.round(width * 0.06), 8, 18)
  const pad = Math.round(width * 0.07)

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background: primary.solid,
        color: primary.onColor,
        padding: pad,
      }}
    >
      {text ? (
        <p
          className="text-left font-serif leading-relaxed first-letter:float-left first-letter:mr-[0.1em] first-letter:font-serif first-letter:text-[3.1em] first-letter:leading-[0.72] first-letter:font-semibold"
          style={{
            fontSize,
            maskImage: "linear-gradient(to bottom, black 78%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 78%, transparent)",
          }}
        >
          {text}
        </p>
      ) : (
        <p className="m-auto font-serif italic opacity-70" style={{ fontSize }}>
          No description
        </p>
      )}

      {year !== null && (
        <span
          className="absolute font-serif tabular-nums opacity-70"
          style={{
            fontSize: Math.round(fontSize * 0.82),
            right: Math.round(pad * 0.8),
            bottom: Math.round(pad * 0.55),
          }}
        >
          {year}
        </span>
      )}
    </div>
  )
}

type SlabProps = {
  book: BookWithRelations
  width: number
  height: number
  thickness: number
  front: ReactNode
  primary: CoverColor
  accent: CoverColor
  edge: "paper" | "plastic"
  spine: SpineInfo
  interactive: boolean
  discs?: number
  onActivate?: () => void
}

// a single turnable 3d slab (a book or a cd case)
function Slab({
  book,
  width,
  height,
  thickness,
  front,
  primary,
  accent,
  edge,
  spine,
  interactive,
  discs = 0,
  onActivate,
}: SlabProps) {
  const half = thickness / 2
  const spineText = accent === primary ? primary.onColor : accent.solid
  const { left, right } = spineLabel(book, spine)

  const rotateY = useSpring(0, SPRING)
  const rotateX = useSpring(0, SPRING)
  const [view, setView] = useState(0)
  const base = useRef({ x: 0, y: 0 })
  const peeking = useRef(false)

  // --- pretext spine fitting (see _/lib/spineFit.ts to remove) ---
  // measure after mount only, so SSR and first client render agree (no
  // hydration mismatch); the spine is rotated away on the cover view anyway
  const [fit, setFit] = useState<SpineFit>({ titleLines: 1, showAuthor: false })
  useEffect(() => {
    if (spine !== "title") return
    setFit(
      fitSpine({
        title: right,
        author: left,
        length: height - 24,
        thickness,
        titleFont: SPINE_TITLE_FONT,
        authorFont: SPINE_AUTHOR_FONT,
        titleSize: SPINE_TITLE_SIZE,
        authorSize: SPINE_AUTHOR_SIZE,
      }),
    )
  }, [spine, right, left, height, thickness])
  // --- end pretext spine fitting ---

  const setViewAngles = (next: number) => {
    const v = VIEWS[next] ?? VIEWS[0]
    rotateY.set(v.y)
    rotateX.set(v.x)
  }

  const handleTap = () => {
    if (!interactive) {
      onActivate?.()
      return
    }
    peeking.current = false
    const next = (view + 1) % VIEWS.length
    setView(next)
    setViewAngles(next)
  }

  const handlePanStart = () => {
    if (!interactive) return
    peeking.current = false
    base.current = { x: rotateY.get(), y: rotateX.get() }
  }

  const handlePan = (_: unknown, info: PanInfo) => {
    if (!interactive) return
    rotateY.set(base.current.x + info.offset.x * DRAG_SENSITIVITY)
    rotateX.set(
      clamp(base.current.y - info.offset.y * DRAG_SENSITIVITY, -45, 45),
    )
  }

  // on release, spring back to the preset view we were on (don't keep the
  // free-dragged angle) — the spring makes this a gentle settle
  const handlePanEnd = () => {
    if (!interactive) return
    setViewAngles(view)
  }

  const handleHoverStart = () => {
    if (!interactive) return
    if (Math.abs(rotateY.get()) < 1 && Math.abs(rotateX.get()) < 1) {
      peeking.current = true
      rotateY.set(24)
    }
  }

  const handleHoverEnd = () => {
    if (peeking.current) {
      peeking.current = false
      rotateY.set(0)
    }
  }

  const edgeV = edge === "plastic" ? CD_EDGE_V : PAGE_EDGE_V
  const edgeH = edge === "plastic" ? CD_EDGE_H : PAGE_EDGE_H

  return (
    <div className="perspective-distant">
      <motion.div
        className="relative transform-3d"
        style={{
          width,
          height,
          rotateX,
          rotateY,
          cursor: interactive ? "grab" : "pointer",
          touchAction: interactive ? "none" : "auto",
        }}
        onTap={handleTap}
        onPanStart={handlePanStart}
        onPan={handlePan}
        onPanEnd={handlePanEnd}
        onHoverStart={handleHoverStart}
        onHoverEnd={handleHoverEnd}
      >
        {/* front cover */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-clip rounded-r-xs [&_img]:rounded-none!"
          style={{ transform: `translateZ(${half}px)` }}
        >
          {front}
        </div>

        {/* back: description */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-l-xs"
          style={{ transform: `rotateY(180deg) translateZ(${half}px)` }}
        >
          <DescriptionBack book={book} primary={primary} width={width} />
        </div>

        {/* spine */}
        <div
          className="pointer-events-none absolute top-0 h-full overflow-hidden"
          style={{
            width: thickness,
            left: -half,
            transform: "rotateY(-90deg)",
            background: primary.solid,
          }}
        >
          <div
            className="absolute top-1/2 left-1/2 flex items-center justify-center px-3"
            style={{
              width: height,
              height: thickness,
              transform: "translate(-50%, -50%) rotate(90deg)",
              color: spineText,
            }}
          >
            {spine === "title" ? (
              <div className="flex w-full flex-col items-center justify-center gap-0.5 text-center leading-tight">
                <span
                  className="max-w-full font-serif"
                  style={{
                    fontSize: SPINE_TITLE_SIZE,
                    display: "-webkit-box",
                    WebkitLineClamp: String(fit.titleLines),
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {right}
                </span>
                {fit.showAuthor && left && (
                  <span
                    className="max-w-full truncate font-sans uppercase opacity-75"
                    style={{
                      fontSize: SPINE_AUTHOR_SIZE - 1,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {left}
                  </span>
                )}
              </div>
            ) : (
              <span className="mx-auto truncate font-serif text-sm tabular-nums">
                {right}
              </span>
            )}
          </div>
        </div>

        {/* fore-edge (pages) */}
        <div
          className="pointer-events-none absolute top-0 h-full"
          style={{
            width: thickness,
            right: -half,
            transform: "rotateY(90deg)",
            background: edgeV,
          }}
        />

        {/* head (top) */}
        <div
          className="pointer-events-none absolute left-0 w-full"
          style={{
            height: thickness,
            top: -half,
            transform: "rotateX(90deg)",
            background: edgeH,
          }}
        />

        {/* tail (bottom) */}
        <div
          className="pointer-events-none absolute left-0 w-full"
          style={{
            height: thickness,
            bottom: -half,
            transform: "rotateX(-90deg)",
            background: edgeH,
          }}
        />

        {/* discs floating inside the case, seen as it turns */}
        {edge === "plastic" && discs > 0 && (
          <DiscStack
            count={discs}
            size={Math.min(width, height)}
            thickness={thickness}
          />
        )}
      </motion.div>
    </div>
  )
}

function SingleBookStage({
  book,
  width,
  spine,
}: {
  book: BookWithRelations
  width: number
  spine: SpineInfo
}) {
  const colors = useCoverColors(book)
  const audiobookOnly = !!book.audiobook && !book.ebook

  const height = audiobookOnly ? width : Math.round(width * 1.5)
  const discs = audiobookOnly ? discCount(book) : 0
  const thickness = audiobookOnly ? cdThickness(discs) : getBookThickness(book)

  return (
    <Slab
      book={book}
      width={width}
      height={height}
      thickness={thickness}
      primary={colors.primary}
      accent={colors.accent}
      edge={audiobookOnly ? "plastic" : "paper"}
      spine={spine}
      interactive
      discs={discs}
      front={
        <CoverFace
          book={book}
          audio={audiobookOnly}
          width={width}
          height={height}
        />
      }
    />
  )
}

function DualStage({
  book,
  width,
  spine,
}: {
  book: BookWithRelations
  width: number
  spine: SpineInfo
}) {
  const ebookColors = useCoverColors(book, { type: "ebook" })
  const audioColors = useCoverColors(book, { type: "audiobook" })
  const [active, setActive] = useState<"ebook" | "audiobook">("ebook")

  const w = Math.round(width * 0.78)
  const ebookThickness = getBookThickness(book)
  const discs = discCount(book)
  const audioThickness = cdThickness(discs)

  const slabWrap = (id: "ebook" | "audiobook", node: ReactNode) => (
    <motion.div
      className="origin-center"
      style={{ zIndex: active === id ? 20 : 10 }}
      animate={{
        scale: active === id ? 1 : 0.82,
        opacity: active === id ? 1 : 0.65,
      }}
      transition={{ type: "spring", stiffness: 200, damping: 24 }}
    >
      {node}
    </motion.div>
  )

  return (
    <div className="flex items-center justify-center gap-3">
      {slabWrap(
        "ebook",
        <Slab
          book={book}
          width={w}
          height={Math.round(w * 1.5)}
          thickness={ebookThickness}
          primary={ebookColors.primary}
          accent={ebookColors.accent}
          edge="paper"
          spine={spine}
          interactive={active === "ebook"}
          onActivate={() => {
            setActive("ebook")
          }}
          front={
            <CoverFace
              book={book}
              audio={false}
              width={w}
              height={Math.round(w * 1.5)}
            />
          }
        />,
      )}

      {slabWrap(
        "audiobook",
        <Slab
          book={book}
          width={w}
          height={w}
          thickness={audioThickness}
          primary={audioColors.primary}
          accent={audioColors.accent}
          edge="plastic"
          spine={spine}
          interactive={active === "audiobook"}
          discs={discs}
          onActivate={() => {
            setActive("audiobook")
          }}
          front={<CoverFace book={book} audio width={w} height={w} />}
        />,
      )}
    </div>
  )
}

function BookStage({
  book,
  width,
  spine,
}: {
  book: BookWithRelations
  width: number
  spine: SpineInfo
}) {
  if (isDualFormat(book)) {
    return <DualStage book={book} width={width} spine={spine} />
  }
  return <SingleBookStage book={book} width={width} spine={spine} />
}

export function Book3D({
  book,
  width,
  spine = "title",
}: {
  book: BookWithRelations
  width: number
  spine?: SpineInfo
}) {
  const [fullscreen, setFullscreen] = useState(false)
  const isMobile = useIsMobile()

  const fullscreenWidth = Math.round(width * (isMobile ? 1.2 : 1.7))

  return (
    <div className="group relative w-fit shrink-0 select-none">
      <BookStage book={book} width={width} spine={spine} />

      <button
        type="button"
        onClick={() => {
          setFullscreen(true)
        }}
        aria-label="View full screen"
        className="bg-background/70 text-foreground/70 hover:text-foreground absolute top-1 right-1 z-30 rounded-md p-1.5 opacity-100 backdrop-blur-sm transition-opacity md:opacity-0 md:group-hover:opacity-100"
      >
        <IconArrowsMaximize className="h-4 w-4" />
      </button>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="flex max-w-[calc(100%-2rem)] items-center justify-center bg-transparent p-10 ring-0 sm:max-w-2xl">
          <DialogTitle className="sr-only">{book.title}</DialogTitle>
          <BookStage book={book} width={fullscreenWidth} spine={spine} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
