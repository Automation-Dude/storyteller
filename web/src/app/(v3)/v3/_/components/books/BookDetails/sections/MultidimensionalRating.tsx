"use client"

import { IconChevronDown, IconPlus, IconTrash, IconX } from "@tabler/icons-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"

import { RatingDisplay } from "@v3/_/components/books/RatingInput"
import { Button } from "@v3/_/components/ui/button"
import { type ChartConfig, ChartContainer } from "@v3/_/components/ui/chart"
import { Checkbox } from "@v3/_/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@v3/_/components/ui/collapsible"
import { Slider } from "@v3/_/components/ui/slider"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import {
  RATING_DIMENSION_MAX,
  RATING_DIMENSION_MIN,
  RATING_DIMENSION_STEP,
  type RatingDimension,
  type RatingDimensionScores,
  computeRatingAverage,
  formatRating,
} from "@/database/ratingDimensions"

// the chart geometry is hand-tuned around this fixed size so the drag overlay,
// the polygon, and the labels all line up; resizing it throws that off.
const SIZE = 280
const LABEL_PADDING = 42
const COMMIT_DELAY = 350

const chartConfig = {
  value: { label: "Score", color: "var(--primary)" },
} satisfies ChartConfig

// the shared Slider primitive types its value as number | readonly number[]
function toNumber(value: number | readonly number[]): number {
  return typeof value === "number" ? value : value[0] ?? 0
}

function snap(value: number): number {
  const clamped = Math.min(
    RATING_DIMENSION_MAX,
    Math.max(RATING_DIMENSION_MIN, value),
  )
  return Math.round(clamped / RATING_DIMENSION_STEP) * RATING_DIMENSION_STEP
}

// recharts RadarChart starts axis 0 at the top (90deg) and lays the rest out
// clockwise; we mirror that so the drag overlay lines up with the polygon.
function axisAngleRad(index: number, count: number): number {
  return ((90 - (index * 360) / count) * Math.PI) / 180
}

function normalizeAngle(rad: number): number {
  let a = rad
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return Math.abs(a)
}

// value-compare so an unstable scores reference doesn't clobber the local draft
function sameScores(a: RatingDimensionScores, b: RatingDimensionScores): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((k) => a[k] === b[k])
}

type Props = {
  dimensions: RatingDimension[]
  scores: RatingDimensionScores | null
  onChange: (scores: RatingDimensionScores) => void
  onRemove: () => void
  // cover-derived accent for the average stars
  color?: string
  className?: string
}

/**
 * Directly-editable radar for the multidimensional ("JoJo") rating. The recharts
 * chart renders the polygon; a transparent svg overlay (sharing the same polar
 * geometry) handles drag/click. The chart is hidden from screen readers, who get
 * the labelled sliders under "Adjust scores" instead.
 */
export function MultidimensionalRating({
  dimensions,
  scores,
  onChange,
  onRemove,
  color,
  className,
}: Props) {
  const t = useTranslation("BookDetailsPage")
  const svgRef = useRef<SVGSVGElement | null>(null)
  const scoresContentRef = useRef<HTMLDivElement | null>(null)

  // keep a ref mirror so pointer handlers always read the latest draft
  const [draft, setDraft] = useState<RatingDimensionScores>(scores ?? {})
  const draftRef = useRef(draft)
  draftRef.current = draft

  const draggingRef = useRef(false)
  const activeIdRef = useRef<string | null>(null)
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // adopt server/optimistic state unless the user is mid-drag; the value
    // compare keeps an unstable scores reference from looping or wiping edits
    if (draggingRef.current) return
    const incoming = scores ?? {}
    if (!sameScores(incoming, draftRef.current)) setDraft({ ...incoming })
  }, [scores])

  useEffect(
    () => () => {
      if (commitTimer.current) clearTimeout(commitTimer.current)
    },
    [],
  )

  const commit = useCallback(
    (next: RatingDimensionScores, immediate: boolean) => {
      if (commitTimer.current) clearTimeout(commitTimer.current)
      if (immediate) {
        onChange(next)
      } else {
        commitTimer.current = setTimeout(() => {
          onChange(next)
        }, COMMIT_DELAY)
      }
    },
    [onChange],
  )

  const setValue = useCallback(
    (id: string, value: number, immediate: boolean) => {
      const next = { ...draftRef.current, [id]: snap(value) }
      draftRef.current = next
      setDraft(next)
      commit(next, immediate)
    },
    [commit],
  )

  const toggle = useCallback(
    (id: string) => {
      const next: RatingDimensionScores =
        id in draftRef.current
          ? Object.fromEntries(
              Object.entries(draftRef.current).filter(([key]) => key !== id),
            )
          : { ...draftRef.current, [id]: 0 }
      draftRef.current = next
      setDraft(next)
      commit(next, true)
    },
    [commit],
  )

  const cx = SIZE / 2
  const cy = SIZE / 2
  const outerRadius = Math.max(SIZE / 2 - LABEL_PADDING, 10)
  const inUseDimensions = dimensions.filter((d) => d.id in draft)
  const deselectedDimensions = dimensions.filter((d) => !(d.id in draft))
  const count = inUseDimensions.length
  const average = computeRatingAverage(draft)

  const data = inUseDimensions.map((d) => ({
    label: d.label,
    value: draft[d.id] ?? 0,
  }))

  // map a pointer event to svg-space coordinates (accounting for css scaling)
  const toLocal = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return null
    const x = ((e.clientX - rect.left) / rect.width) * SIZE
    const y = ((e.clientY - rect.top) / rect.height) * SIZE
    return { dx: x - cx, dy: cy - y }
  }

  const applyAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const id = activeIdRef.current
    if (!id) return
    const local = toLocal(e)
    if (!local) return
    const index = inUseDimensions.findIndex((d) => d.id === id)
    if (index < 0) return
    const a = axisAngleRad(index, count)
    // project the pointer onto the axis spoke to get the radius
    const proj = local.dx * Math.cos(a) + local.dy * Math.sin(a)
    setValue(id, (proj / outerRadius) * RATING_DIMENSION_MAX, false)
  }

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (count === 0) return
    const local = toLocal(e)
    if (!local) return
    if (Math.hypot(local.dx, local.dy) < 8) return // dead zone at center
    // pick the axis whose spoke the pointer is closest to (by angle)
    const pointerAngle = Math.atan2(local.dy, local.dx)
    let best = 0
    let bestDiff = Infinity
    inUseDimensions.forEach((_, i) => {
      const diff = normalizeAngle(pointerAngle - axisAngleRad(i, count))
      if (diff < bestDiff) {
        bestDiff = diff
        best = i
      }
    })
    activeIdRef.current = inUseDimensions[best]?.id ?? null
    draggingRef.current = true
    svgRef.current?.setPointerCapture(e.pointerId)
    applyAt(e)
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingRef.current) applyAt(e)
  }

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    activeIdRef.current = null
    svgRef.current?.releasePointerCapture(e.pointerId)
    commit(draftRef.current, true)
  }

  // when the sliders open, move focus into them so keyboard/screen-reader users
  // land on the first control instead of having to hunt for it
  const handleScoresOpen = (open: boolean) => {
    if (!open) return
    requestAnimationFrame(() => {
      scoresContentRef.current
        ?.querySelector<HTMLElement>('[role="slider"], input, button')
        ?.focus()
    })
  }

  return (
    <div className={cn("relative flex flex-col items-center gap-4", className)}>
      <div
        className="relative mx-auto aspect-square h-[260px] w-[280px]"
        // hidden from screen readers; they use the sliders under "Adjust scores"
        aria-hidden
      >
        <ChartContainer
          config={chartConfig}
          className="relative flex h-full w-full items-center"
        >
          <RadarChart
            data={data}
            cx={cx}
            cy={cy}
            outerRadius={outerRadius}
            startAngle={90}
            endAngle={-270}
          >
            <PolarGrid width={SIZE} height={SIZE} />
            <PolarRadiusAxis
              domain={[RATING_DIMENSION_MIN, RATING_DIMENSION_MAX]}
              tickCount={RATING_DIMENSION_MAX + 1}
              tick={false}
              axisLine={false}
            />
            <Radar
              dataKey="value"
              stroke="var(--color-value)"
              fill="var(--color-value)"
              fillOpacity={0.45}
              dot={{ r: 3, fillOpacity: 1 }}
              isAnimationActive={false}
            />
          </RadarChart>

          {/* manual labels; driving them through the chart config makes recharts
              flash the labels on every edit */}
          {inUseDimensions.map((d, i) => {
            const radAngle = axisAngleRad(i, count)
            return (
              <div
                key={d.id}
                className="group/label absolute z-30 flex flex-col items-center justify-center text-center text-sm"
                style={{
                  left: cx + outerRadius * Math.cos(radAngle),
                  top: cy - outerRadius * Math.sin(radAngle),
                  transform: `translate(calc(${i === 0 ? 0 : Math.sign(Math.cos(radAngle)) * 30}px - 50%), calc(${-Math.sin(radAngle) * 20}px - 50%))`,
                }}
              >
                <span>{d.label}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatRating(draft[d.id] ?? 0)}
                </span>
                <Button
                  className="absolute top-2 -right-6 hidden -translate-y-1/2 rounded-full group-hover/label:flex hover:bg-transparent"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("review.removeDimension", { label: d.label })}
                  onClick={() => {
                    toggle(d.id)
                  }}
                >
                  <IconX />
                </Button>
              </div>
            )
          })}
        </ChartContainer>

        {/* interactive overlay: shares cx/cy/outerRadius with the chart above */}
        <svg
          ref={svgRef}
          width={SIZE}
          height={SIZE}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {inUseDimensions.map((d, i) => {
            const r = ((draft[d.id] ?? 0) / RATING_DIMENSION_MAX) * outerRadius
            const a = axisAngleRad(i, count)
            const x = cx + r * Math.cos(a)
            const y = cy - r * Math.sin(a)
            return (
              <circle
                key={d.id}
                cx={x}
                cy={y}
                r={7}
                className="fill-primary stroke-background cursor-grab stroke-2"
              />
            )
          })}
        </svg>
      </div>

      {/* live average, centered under the radar so edits are easy to read off */}
      <div className="flex flex-col items-center gap-0.5">
        <RatingDisplay rating={average} color={color} size="lg" />
        <span className="text-muted-foreground text-xs tabular-nums">
          {t("review.avg")} {average == null ? "–" : formatRating(average)}
        </span>
      </div>

      {/* re-add axes the user deselected without digging into the sliders */}
      {deselectedDimensions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {deselectedDimensions.map((d) => (
            <Button
              key={d.id}
              type="button"
              size="xs"
              variant="outline"
              className="text-muted-foreground rounded-full"
              onClick={() => {
                toggle(d.id)
              }}
            >
              <IconPlus />
              {d.label}
            </Button>
          ))}
        </div>
      )}

      <Collapsible className="group w-full max-w-xs" onOpenChange={handleScoresOpen}>
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground mx-auto flex items-center gap-1 text-xs">
          <IconChevronDown className="h-3.5 w-3.5 transition-transform group-data-open:rotate-180" />
          {t("review.adjustScores")}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div ref={scoresContentRef} className="mt-3 flex flex-col gap-2.5">
            {dimensions.map((d) => {
              const selected = d.id in draft
              const value = draft[d.id] ?? 0
              return (
                <div key={d.id} className="flex items-center gap-3">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => {
                      toggle(d.id)
                    }}
                    aria-label={d.label}
                  />
                  <span className="w-20 shrink-0 truncate text-sm">
                    {d.label}
                  </span>
                  <Slider
                    aria-label={d.label}
                    className="flex-1"
                    min={RATING_DIMENSION_MIN}
                    max={RATING_DIMENSION_MAX}
                    step={RATING_DIMENSION_STEP}
                    value={value}
                    disabled={!selected}
                    onValueChange={(next) => {
                      setValue(d.id, toNumber(next), false)
                    }}
                    onValueCommitted={(next) => {
                      setValue(d.id, toNumber(next), true)
                    }}
                  />
                  <span className="text-muted-foreground w-7 shrink-0 text-right text-sm tabular-nums">
                    {selected ? formatRating(value) : "–"}
                  </span>
                </div>
              )
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* visually top-right, but last in the dom so it comes last in tab order */}
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        onClick={onRemove}
        aria-label={t("review.removeAdvanced")}
        className="text-muted-foreground hover:text-foreground absolute top-0 right-0"
      >
        <IconTrash />
      </Button>
    </div>
  )
}
