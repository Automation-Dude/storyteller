"use client"

import { IconChevronDown, IconX } from "@tabler/icons-react"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"

import { type ChartConfig, ChartContainer } from "@v3/_/components/ui/chart"
import { Checkbox } from "@v3/_/components/ui/checkbox"
import { Slider } from "@v3/_/components/ui/slider"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import {
  RATING_DIMENSION_MAX,
  RATING_DIMENSION_MIN,
  RATING_DIMENSION_STEP,
  type RatingDimension,
  type RatingDimensionScores,
  formatRating,
} from "@/database/ratingDimensions"
import { Button } from "../../../ui/button"
import { getClientXY } from "@/components/reader/hooks/mouseHelpers"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../ui/collapsible"

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

type Props = {
  dimensions: RatingDimension[]
  scores: RatingDimensionScores | null
  onChange: (scores: RatingDimensionScores) => void
  onRemove: () => void
  className?: string
}

/**
 * Directly-editable radar for the multidimensional ("JoJo") rating. The recharts
 * chart renders the polygon; a transparent svg overlay (sharing the same polar
 * geometry) handles drag/click, with per-axis sliders below for touch + a11y.
 */
export function MultidimensionalRating({
  dimensions,
  scores,
  onChange,
  onRemove,
  className,
}: Props) {
  const t = useTranslation("BookDetailsPage")
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [size, setSize] = useState(280)

  // keep a ref mirror so pointer handlers always read the latest draft
  const [draft, setDraft] = useState<RatingDimensionScores>(scores ?? {})
  const draftRef = useRef(draft)
  draftRef.current = draft

  const draggingRef = useRef(false)
  const activeIdRef = useRef<string | null>(null)
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // adopt server/optimistic state unless the user is mid-drag (scores is a
    // stable reference from the rtk cache, so this only runs when it changes)
    if (!draggingRef.current) setDraft(scores ? { ...scores } : {})
  }, [scores])

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth
      if (width > 0) setSize(width)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [])

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

  const cx = size / 2
  const cy = size / 2
  const outerRadius = Math.max(size / 2 - LABEL_PADDING, 10)
  const inUseDimensions = dimensions.filter((d) => d.id in draft)
  const count = inUseDimensions.length

  const data = inUseDimensions.map((d) => ({
    label: d.label,
    value: draft[d.id] ?? 0,
  }))

  // // map a pointer event to svg-space coordinates (accounting for css scaling)
  const toLocal = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return null
    const [clientX, clientY] = getClientXY(e.nativeEvent)
    if (!clientX || !clientY) return null
    const x = ((clientX - rect.left) / rect.width) * size
    const y = ((clientY - rect.top) / rect.height) * size
    return { dx: x - cx, dy: cy - y }
  }

  const applyAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const id = activeIdRef.current
    if (!id) return
    const local = toLocal(e)
    if (!local) return
    const index = inUseDimensions.findIndex((d: RatingDimension) => d.id === id)
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

  return (
    <div>
      {/* <div className="h-[70cqw] w-[70cqw] bg-red-500"></div> */}
      <div
        className={cn(
          "flex flex-col gap-12 @xl/book:flex-row @xl/book:items-center @xl/book:justify-between @xl/book:gap-3",
          className,
        )}
      >
        <div
          className="relative mx-auto aspect-square h-[260px] w-[280px] flex-1"
          // dont show this to screen readers,
          // they should use the sliders below instead
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
              <PolarGrid width={size} height={size} />
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
            {/* manually add labels, changing config causes flash of labels in recharts otherwise */}
            {inUseDimensions.map((d, i) => {
              const radAngle = axisAngleRad(i, count)
              return (
                <div
                  key={d.id}
                  className="group/label relative z-30 flex flex-col items-center justify-center"
                  style={{
                    position: "absolute",
                    left: cx + outerRadius * Math.cos(radAngle),
                    top: cy - outerRadius * Math.sin(radAngle),
                    transform: `translate(calc(${i === 0 ? 0 : Math.sign(Math.cos(radAngle)) * 30}px - 50%), calc(${-Math.sin(radAngle) * 20}px - 50%))`,
                  }}
                >
                  <span>{d.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {draft[d.id] ?? 0}
                  </span>
                  <Button
                    className="absolute top-2 -right-6 hidden -translate-y-1/2 items-center rounded-full group-hover/label:block hover:bg-transparent"
                    size="xs"
                    variant="ghost"
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
            width={size}
            height={size}
            className="absolute inset-0 h-full w-full touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {inUseDimensions.map((d, i) => {
              if (!(d.id in draft)) return null
              const r =
                ((draft[d.id] ?? 0) / RATING_DIMENSION_MAX) * outerRadius
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

          {/* <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums">
            {average == null ? "–" : formatRating(average)}
          </span>
          <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
            {t("review.avg")}
          </span>
        </div> */}
        </div>

        <Collapsible className="group">
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 self-start text-xs">
            <IconChevronDown className="h-3.5 w-3.5 group-data-open:rotate-180" />
            Advanced
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-col gap-1.5 @xl/book:mx-10 @xl/book:my-0">
              {dimensions.map((d) => {
                const selected = d.id in draft
                const value = draft[d.id] ?? 0
                return (
                  <div key={d.id} className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="shrink-0 truncate text-xs font-medium">
                        {d.label}
                      </span>
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => {
                          toggle(d.id)
                        }}
                        aria-label={`Toggle ${d.label}`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Slider
                        aria-label={`${d.label} score`}
                        className="h-2 w-40 flex-1"
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
                        id={`${d.label}-slider`}
                      />
                      <span
                        // htmlFor={`${d.label}-slider`}
                        className="text-muted-foreground w-7 shrink-0 text-right text-sm tabular-nums"
                      >
                        {selected ? formatRating(value) : "–"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 self-start text-xs"
      >
        <IconX className="h-3.5 w-3.5" />
        {t("review.removeAdvanced")}
      </button>
    </div>
  )
}
