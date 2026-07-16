"use client"

import { type Variant } from "motion/react"
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { type JsColor } from "@storyteller-platform/okmain"

import { useUserPreferences } from "@/app/(v3)/v3/_/components/user-preferences-provider"
import { useIsMobile } from "@/app/(v3)/v3/_/hooks/use-mobile"
import { cn } from "@/cn"
import { type BookWithRelations } from "@/database/books"
import { getCoverUrl } from "@/store/api"


import { FallbackCover } from "./BookCover"
import {
  getBlurhashAverageColor,
  getBlurhashDataUri,
  getBlurhashGradient,
} from "./blurhash-data-uri"
// import { BookDoubleCover } from "./BookDoubleCover"

// cap DPR at 2: a 3x fetch triples decode cost for no visible gain on a small
// grid cell.
const DPR =
  typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1

// ── experiment settings ────────────────────────────────────────────────────
// defaults are the production-sane choice; the lab (test page) overrides them
// via the provider so behaviors can be toggled and compared side by side.

export type BlurhashMode = "gradient" | "canvas" | "none"
export type DoubleCoverMode = "waapi" | "css" | "static"

export type CoverSettings = {
  blurhash: BlurhashMode
  doubleCover: DoubleCoverMode
  deferWhileScrolling: boolean
}

export const DEFAULT_COVER_SETTINGS: CoverSettings = {
  blurhash: "canvas",
  doubleCover: "waapi",
  deferWhileScrolling: true,
}

const CoverSettingsContext = createContext<CoverSettings>(
  DEFAULT_COVER_SETTINGS,
)
export const CoverSettingsProvider = CoverSettingsContext.Provider
export function useCoverSettings(): CoverSettings {
  return useContext(CoverSettingsContext)
}

// whether images are allowed to begin their network load. the grid flips this
// off while scrolling so cover requests don't starve the next-page fetch on
// HTTP/1 (six-connection cap). defaults to true so non-grid callers just load.
const CoverLoadContext = createContext(true)
export const CoverLoadProvider = CoverLoadContext.Provider

// exported so callers can match their layout (e.g. overflow-visible for the
// spread animation) to exactly when Cover renders a double cover.
export function isDual(book: BookWithRelations): boolean {
  const synced = book.readaloud !== null && book.readaloud.status === "ALIGNED"
  return synced || (book.ebook !== null && book.audiobook !== null)
}

// ── tile ────────────────────────────────────────────────────────────────────

function blurhashStyle(
  mode: BlurhashMode,
  blurhash: string | null | undefined,
): React.CSSProperties | undefined {
  if (mode === "none") return undefined

  if (mode === "canvas") {
    const uri = getBlurhashDataUri(blurhash)
    return uri
      ? {
          backgroundImage: `url(${uri})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : undefined
  }

  // gradient: cheap multi-radial approximation over the average tone.
  return {
    backgroundColor: getBlurhashAverageColor(blurhash) ?? undefined,
    backgroundImage: getBlurhashGradient(blurhash) ?? undefined,
  }
}

type TileProps = {
  src: string
  // used only for the FallbackCover title; the <img> itself is decorative
  // (alt="") because the card renders the title alongside it.
  alt: string
  blurhash: string | null | undefined
  colors: JsColor[] | null | undefined
  type: "audiobook" | "ebook"
  className?: string
}

// a single cover image. blurhash sits behind as a cheap placeholder; the <img>
// decodes off the main thread and paints on top. no loaded-state, so a settled
// tile never re-renders. radius is inherited from whatever the caller rounds.
export const Tile = memo(function Tile({
  src,
  alt,
  blurhash,
  colors,
  type,
  className,
}: TileProps) {
  const { blurhash: mode } = useCoverSettings()
  const canLoad = useContext(CoverLoadContext)
  // latch: once we've been allowed to load, stay loaded so a later scroll (which
  // flips canLoad back off) never yanks the src and forces a re-decode.
  const [load, setLoad] = useState(canLoad)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    if (canLoad) setLoad(true)
  }, [canLoad])

  if (errored) {
    return (
      <FallbackCover
        title={alt}
        type={type}
        colors={colors}
        className={cn("rounded-[inherit]", className)}
      />
    )
  }

  return (
    <div
      className={cn("relative overflow-hidden rounded-[inherit]", className)}
      style={blurhashStyle(mode, blurhash)}
    >
      {load && (
        <img
          src={src}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onError={() => {
            setErrored(true)
          }}
          className="h-full w-full rounded-[inherit] object-contain"
        />
      )}
    </div>
  )
})

// ── double cover ─────────────────────────────────────────────────────────────

type Face = {
  src: string
  alt: string
  blurhash: string | null | undefined
  colors: JsColor[] | null | undefined
}

type DoubleCoverProps = {
  audio: Face
  ebook: Face
  className?: string
}

function AudioTile({ face }: { face: Face }) {
  return (
    <Tile
      src={face.src}
      alt={face.alt}
      blurhash={face.blurhash}
      colors={face.colors}
      type="audiobook"
      className="h-full w-full rounded-sm shadow-md"
    />
  )
}

function EbookTile({ face }: { face: Face }) {
  return (
    <Tile
      src={face.src}
      alt={face.alt}
      blurhash={face.blurhash}
      colors={face.colors}
      type="ebook"
      className="h-full w-full rounded-sm shadow-md"
    />
  )
}

const AUDIO_BOX: React.CSSProperties = { width: "82%", aspectRatio: "1 / 1" }
const EBOOK_BOX: React.CSSProperties = { width: "82%", aspectRatio: "2 / 3" }

// idle stack, wide mid-spread (where the restack hides), swapped rest. scale is
// present in every state so WAAPI interpolates matching transform lists.
const DC_DURATION = 440
const DC_EASE = "cubic-bezier(0.22, 1, 0.36, 1)"
const DC_Z_PEAK = 0.45
const DC = {
  idleEbook: "translateX(-10%) rotate(-2.5deg) scale(1)",
  idleAudio: "translateX(15%) rotate(2.5deg) scale(1)",
  hoverEbook: "translateX(15%) rotate(2.5deg) scale(0.94)",
  hoverAudio: "translateX(-10%) rotate(-2.5deg) scale(1.04)",
  peakEbook: "translateX(-46%) rotate(-5deg) scale(0.98)",
  peakAudio: "translateX(46%) rotate(5deg) scale(1.02)",
}

// the interruptible / reversible peak-swap. WAAPI is the honest tool for a
// three-point arc that reverses mid-flight; commitStyles carries the current
// visual position across an interruption so hovering in/out repeatedly stays
// smooth. it can only fire when stationary (the grid drops pointer-events while
// scrolling), so its cost never lands on a scroll frame.
function WaapiDoubleCover({ audio, ebook, className }: DoubleCoverProps) {
  const ebookRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLDivElement>(null)
  const zTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const anims = useRef<Animation[]>([])

  useLayoutEffect(() => {
    const eb = ebookRef.current
    const ab = audioRef.current
    if (!eb || !ab) return
    eb.style.transform = DC.idleEbook
    eb.style.zIndex = "20"
    ab.style.transform = DC.idleAudio
    ab.style.zIndex = "10"
  }, [])

  const run = useCallback((hover: boolean) => {
    const eb = ebookRef.current
    const ab = audioRef.current
    if (!eb || !ab) return

    for (const a of anims.current) {
      try {
        a.commitStyles()
      } catch {
        // commitStyles throws if the element detached mid-flight; ignore.
      }
      a.cancel()
    }
    clearTimeout(zTimer.current)

    const opts = {
      duration: DC_DURATION,
      easing: DC_EASE,
      fill: "forwards" as const,
    }
    anims.current = [
      eb.animate(
        [
          { transform: DC.peakEbook, offset: DC_Z_PEAK },
          { transform: hover ? DC.hoverEbook : DC.idleEbook },
        ],
        opts,
      ),
      ab.animate(
        [
          { transform: DC.peakAudio, offset: DC_Z_PEAK },
          { transform: hover ? DC.hoverAudio : DC.idleAudio },
        ],
        opts,
      ),
    ]

    // flip stacking at the spread peak, when the swap is out of sight.
    zTimer.current = setTimeout(() => {
      eb.style.zIndex = hover ? "10" : "20"
      ab.style.zIndex = hover ? "20" : "10"
    }, DC_DURATION * DC_Z_PEAK)
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(zTimer.current)
      for (const a of anims.current) a.cancel()
    }
  }, [])

  return (
    <div
      className={cn("relative h-full w-full", className)}
      onPointerEnter={() => {
        run(true)
      }}
      onPointerLeave={() => {
        run(false)
      }}
    >
      <div ref={audioRef} className="absolute inset-0 m-auto" style={AUDIO_BOX}>
        <AudioTile face={audio} />
      </div>
      <div ref={ebookRef} className="absolute inset-0 m-auto" style={EBOOK_BOX}>
        <EbookTile face={ebook} />
      </div>
    </div>
  )
}

// pure-CSS cross-swap: the z-index flip is delayed to the crossover midpoint via
// `transition: z-index 0s <delay>`; transitions run from the current value so
// it's reversible for free. no mid spread (a two-endpoint transition can't
// peak), so covers cross through center rather than spreading wide.
function CssDoubleCover({ audio, ebook, className }: DoubleCoverProps) {
  const tileTransition =
    "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), z-index 0s 0.175s"
  return (
    <div className={cn("group/dc relative h-full w-full", className)}>
      <div
        className={cn(
          "absolute inset-0 z-10 m-auto",
          "transform-[translateX(15%)_rotate(2.5deg)]",
          "group-hover/dc:z-20 group-hover/dc:transform-[translateX(-10%)_rotate(-2.5deg)_scale(1.03)]",
        )}
        style={{ ...AUDIO_BOX, transition: tileTransition }}
      >
        <AudioTile face={audio} />
      </div>
      <div
        className={cn(
          "absolute inset-0 z-20 m-auto",
          "transform-[translateX(-10%)_rotate(-2.5deg)]",
          "group-hover/dc:z-10 group-hover/dc:transform-[translateX(15%)_rotate(2.5deg)_scale(0.94)]",
        )}
        style={{ ...EBOOK_BOX, transition: tileTransition }}
      >
        <EbookTile face={ebook} />
      </div>
    </div>
  )
}

// no interaction at all: cheapest to mount.
function StaticDoubleCover({ audio, ebook, className }: DoubleCoverProps) {
  return (
    <div className={cn("relative h-full w-full", className)}>
      <div
        className="absolute inset-0 z-10 m-auto"
        style={{ ...AUDIO_BOX, transform: "translateX(15%) rotate(2.5deg)" }}
      >
        <AudioTile face={audio} />
      </div>
      <div
        className="absolute inset-0 z-20 m-auto"
        style={{ ...EBOOK_BOX, transform: "translateX(-10%) rotate(-2.5deg)" }}
      >
        <EbookTile face={ebook} />
      </div>
    </div>
  )
}

function _DoubleCover({
  interactive = true,
  ...props
}: DoubleCoverProps & { interactive?: boolean }) {
  const { doubleCover } = useCoverSettings()
  // selection mode (or any non-interactive context) freezes the spread so
  // hovering to pick a book doesn't animate.
  if (!interactive || doubleCover === "static")
    return <StaticDoubleCover {...props} />
  if (doubleCover === "css") return <CssDoubleCover {...props} />
  return <WaapiDoubleCover {...props} />
}

// ── cover ────────────────────────────────────────────────────────────────────

// lean book cover for dense grids. round it by putting a `rounded-*` class in
// `className` — tiles inherit the radius, so there's nothing else to thread
// through. dual-format behavior (animation + blurhash) is driven by the cover
// settings context so it can be tuned in the lab.
export const Cover = memo(function Cover({
  book,
  width = 150,
  interactive = true,
  className,
}: {
  book: BookWithRelations
  width?: number
  // when false, the double cover renders static (no hover spread)
  interactive?: boolean
  className?: string
}) {
  const w = Math.round(width * DPR)
  const h = Math.round(width * 1.5 * DPR)
  const { doubleCoverAlignment } = useUserPreferences()

  if (isDual(book)) {
    // const colors = book.ebook?.coverColors ?? book.readaloud?.coverColors
    // const ebookUrl = getCoverUrl(book.uuid, {
    //   width: w,
    //   height: h,
    //   audio: false,
    //   updatedAt: book.ebook?.updatedAt ?? book.updatedAt,
    // })
    // const audiobookUrl = getCoverUrl(book.uuid, {
    //   width: w,
    //   height: w,
    //   audio: true,
    //   updatedAt: book.audiobook?.updatedAt ?? book.updatedAt,
    // })
    return (
      <BookDoubleCover
        book={book}
        width={width}
        // interactive={interactive}
        forceAligned={doubleCoverAlignment === "straight"}
        disableHover={!interactive}
      />
      // <DoubleCover
      //   className={className}
      //   interactive={interactive}
      //   audio={{
      //     src: audiobookUrl,
      //     alt: book.title,
      //     blurhash: book.audiobook?.coverBlurhash,
      //     colors,
      //   }}
      //   ebook={{
      //     src: ebookUrl,
      //     alt: book.title,
      //     blurhash: book.ebook?.coverBlurhash,
      //     colors,
      //   }}
      // />
    )
  }

  if (book.audiobook && !book.ebook) {
    const audiobookUrl = getCoverUrl(book.uuid, {
      width: w,
      height: w,
      audio: true,
      updatedAt: book.audiobook.updatedAt,
    })
    return (
      <Tile
        src={audiobookUrl}
        alt={book.title}
        blurhash={book.audiobook.coverBlurhash}
        colors={book.audiobook.coverColors}
        type="audiobook"
        className={cn("aspect-square h-full shadow-sm", className)}
      />
    )
  }

  const ebookUrl = getCoverUrl(book.uuid, {
    width: w,
    height: h,
    audio: false,
    updatedAt: book.ebook?.updatedAt ?? book.updatedAt,
  })
  return (
    <Tile
      src={ebookUrl}
      alt={book.title}
      blurhash={book.ebook?.coverBlurhash}
      colors={book.ebook?.coverColors}
      type="ebook"
      className={cn("aspect-2/3 h-full shadow-sm", className)}
    />
  )
})

// old double cover

const TILE_CLASS =
  "absolute inset-0 m-auto  shadow-md group-hover/covers:overflow-hidden  "

type Pos = { x: string; scale: number; z: number; rotateX?: number } & Variant
type CoverState = "idle" | "separated" | "audiobook-front"

const SHUFFLE_MS = 450
const SIMPLE_MS = 220
const PEAK_FRACTION = 0.4

function tx(p: { x: string; scale: number; rotateX?: number }) {
  return `translateX(${p.x}) scale(${p.scale})${p.rotateX ? ` rotate(${p.rotateX}deg)` : ""}`
}

function transformKeyframes(
  target: Pos,
  peak: { x: string; scale: number; rotateX?: number },
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
  forceAligned,
  onLoadingChange,
}: {
  book: BookWithRelations
  width?: number
  disableHover?: boolean
  forceAligned?: boolean
  onLoadingChange?: (loading: boolean) => void
}) {
  const isMobile = useIsMobile()
  const hoverDisabled = disableHover || isMobile

  const bookIsAligned = book.readaloud?.status === "ALIGNED"
  const isAligned = forceAligned || bookIsAligned

  const STATES: Record<CoverState, { audiobook: Pos; ebook: Pos }> = {
    idle: {
      audiobook: { x: "10%", scale: 1, z: 10, rotateX: isAligned ? 0 : 2.5 },
      ebook: { x: "-10%", scale: 1, z: 20, rotateX: isAligned ? 0 : -2.5 },
    },
    separated: {
      audiobook: { x: "18%", scale: 0.8, z: 10, rotateX: isAligned ? 0 : 2.5 },
      ebook: { x: "-18%", scale: 0.8, z: 20, rotateX: isAligned ? 0 : -2.5 },
    },
    "audiobook-front": {
      audiobook: { x: "5%", scale: 1.05, z: 20, rotateX: isAligned ? 0 : 2.5 },
      ebook: { x: "-15%", scale: 0.9, z: 10, rotateX: isAligned ? 0 : -2.5 },
    },
  }

  const PEAK = {
    audiobook: { x: "48%", scale: 0.85 },
    ebook: { x: "-48%", scale: 0.85 },
  }

  const audiobookRef = useRef<HTMLDivElement>(null)
  const ebookRef = useRef<HTMLDivElement>(null)

  const [audioLoading, _setAudioLoading] = useState(true)
  const [ebookLoading, _setEbookLoading] = useState(true)

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

  const _fallbackColors = book.ebook?.coverColors ?? book.readaloud?.coverColors

  return (
    <div
      className="group/covers relative h-full w-full"
      onPointerEnter={() => {
        if (hoverDisabled) return
        if (stateRef.current === "idle") transitionTo("separated")
      }}
      onPointerLeave={() => {
        if (hoverDisabled) return
        transitionTo("idle")
      }}
    >
      <div
        ref={audiobookRef}
        className={TILE_CLASS}
        style={{ width: "82%", aspectRatio: "1 / 1" }}
        onPointerEnter={() => {
          if (hoverDisabled) return
          transitionTo("audiobook-front")
        }}
        onPointerLeave={(e) => {
          if (hoverDisabled) return
          // if we're still inside the cover-stack, fall back to separated
          const next = e.relatedTarget as Node | null
          if (next && e.currentTarget.parentElement?.contains(next)) {
            transitionTo("separated")
          }
        }}
      >
        <Tile
          src={audiobookUrl}
          alt={book.title}
          blurhash={book.audiobook?.coverBlurhash}
          type="audiobook"
          className="h-full w-full rounded-sm"
          colors={book.audiobook?.coverColors}
        />
      </div>
      <div
        ref={ebookRef}
        className={TILE_CLASS}
        style={{ width: "82%", aspectRatio: "2 / 3" }}
      >
        <Tile
          src={ebookUrl}
          alt={book.title}
          blurhash={book.ebook?.coverBlurhash}
          type="ebook"
          className="h-full w-full rounded-sm"
          colors={book.ebook?.coverColors}
        />
      </div>
    </div>
  )
}
