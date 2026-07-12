"use client"

import { memo, useEffect, useMemo, useState } from "react"

import { cn } from "@v3/_/lib/utils"

import {
  type BlurhashMode,
  Cover,
  CoverLoadProvider,
  type CoverSettings,
  CoverSettingsProvider,
  DEFAULT_COVER_SETTINGS,
  type DoubleCoverMode,
  useCoverSettings,
} from "@/app/(v3)/v3/_/components/books/Cover"
import {
  type VirtualGridGeometry,
  useVirtualGrid,
} from "@/app/(v3)/v3/_/hooks/use-virtual-grid"
import { type BookWithRelations } from "@/database/books"
import { useListInfiniteBooksInfiniteQuery } from "@/store/api"

const GAP_X = 18
const GAP_Y = 18
const PAD_X = 48
const PAD_Y = 24
const MIN_W = 200
const COVER_ASPECT = 3 / 2
const META_H = 52
const OVERSCAN_ROWS = 4
const COVER_FETCH_WIDTH = 150

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

export default function TestPage() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useListInfiniteBooksInfiniteQuery({ limit: 100 })
  const items = useMemo(() => data?.pages.flat() ?? [], [data])

  const [settings, setSettings] = useState<CoverSettings>(
    DEFAULT_COVER_SETTINGS,
  )

  return (
    <CoverSettingsProvider value={settings}>
      <div className="flex h-screen w-full flex-col">
        <h1 className="shrink-0 px-6 py-3 text-lg font-semibold">
          Test grid ({items.length})
        </h1>
        <div className="min-h-0 flex-1">
          <VirtualGrid
            items={items}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
          />
        </div>
        <FpsMeter />
        <LabPanel settings={settings} onChange={setSettings} />
      </div>
    </CoverSettingsProvider>
  )
}

function VirtualGrid({
  items,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  items: BookWithRelations[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}) {
  const settings = useCoverSettings()
  const [selected, setSelected] = useState<number | null>(null)

  const geometry = useMemo<VirtualGridGeometry>(
    () => ({
      minColumnWidth: MIN_W,
      gapX: GAP_X,
      gapY: GAP_Y,
      padX: PAD_X,
      padY: PAD_Y,
      rowHeightForColumnWidth: (w) => w * COVER_ASPECT + META_H,
    }),
    [],
  )

  const grid = useVirtualGrid({
    itemCount: items.length,
    geometry,
    overscanRows: OVERSCAN_ROWS,
    anchorIndex: selected,
    animate: true,
    reducedMotion: prefersReducedMotion,
    hasNextPage,
    isFetchingNextPage,
    onFetchNextPage: fetchNextPage,
    deferCoverLoads: settings.deferWhileScrolling,
  })

  const { startIndex, endIndex, metrics } = grid
  const visible = items.slice(startIndex, endIndex)

  return (
    <div className="h-full w-full overflow-y-auto">
      <div ref={grid.sizerRef} style={grid.sizerStyle}>
        <CoverLoadProvider value={grid.imagesActive}>
          <div ref={grid.gridRef} style={grid.gridStyle}>
            {visible.map((book, i) => {
              const index = startIndex + i
              return (
                <Card
                  key={book.uuid}
                  index={index}
                  book={book}
                  height={metrics.rowHeight}
                  coverHeight={metrics.rowHeight - META_H}
                  selected={selected === index}
                  onSelect={setSelected}
                />
              )
            })}
          </div>
        </CoverLoadProvider>
      </div>
    </div>
  )
}

export const Card = memo(function Card({
  book,
  index,
  height,
  coverHeight,
  selected,
  onSelect,
}: {
  book: BookWithRelations
  index: number
  height: number
  coverHeight: number
  selected: boolean
  onSelect: (index: number) => void
}) {
  return (
    <button
      type="button"
      data-index={index}
      onClick={() => {
        onSelect(index)
      }}
      style={{ height }}
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg text-left outline-none",
        selected && "ring-primary ring-2 ring-offset-2",
      )}
    >
      <div
        className="flex items-center justify-center"
        style={{ height: coverHeight }}
      >
        <Cover book={book} width={COVER_FETCH_WIDTH} className="rounded-md" />
      </div>
      <div className="min-h-0 px-0.5" style={{ height: META_H }}>
        <h3 className="line-clamp-2 text-sm leading-tight font-medium">
          {book.title}
        </h3>
        <p className="text-muted-foreground line-clamp-1 text-xs">
          {book.authors.map((a) => a.name).join(", ")}
        </p>
      </div>
    </button>
  )
})

// dev-only frame-rate readout, sampled every 500ms.
function FpsMeter() {
  const [fps, setFps] = useState(0)

  useEffect(() => {
    let raf = 0
    let frames = 0
    let last = performance.now()
    const loop = (now: number) => {
      frames++
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)))
        frames = 0
        last = now
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="fixed top-3 right-3 z-50 rounded bg-black/70 px-2 py-1 font-mono text-xs text-white tabular-nums">
      {fps} fps
    </div>
  )
}

// small experiment panel: toggle cover behaviors and compare live.
function LabPanel({
  settings,
  onChange,
}: {
  settings: CoverSettings
  onChange: (next: CoverSettings) => void
}) {
  const set = <K extends keyof CoverSettings>(
    key: K,
    value: CoverSettings[K],
  ) => {
    onChange({ ...settings, [key]: value })
  }

  return (
    <div className="fixed bottom-3 left-3 z-50 flex w-56 flex-col gap-3 rounded-lg border border-white/10 bg-black/80 p-3 font-mono text-xs text-white shadow-lg">
      <LabRadio
        label="blurhash"
        value={settings.blurhash}
        options={["gradient", "canvas", "none"]}
        onChange={(v: BlurhashMode) => {
          set("blurhash", v)
        }}
      />
      <LabRadio
        label="double cover"
        value={settings.doubleCover}
        options={["waapi", "css", "static"]}
        onChange={(v: DoubleCoverMode) => {
          set("doubleCover", v)
        }}
      />
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.deferWhileScrolling}
          onChange={(e) => {
            set("deferWhileScrolling", e.target.checked)
          }}
        />
        defer covers near tail
      </label>
    </div>
  )
}

function LabRadio<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: T[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-white/50 uppercase">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              onChange(option)
            }}
            className={cn(
              "rounded px-2 py-0.5",
              option === value
                ? "bg-white text-black"
                : "bg-white/10 hover:bg-white/20",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
