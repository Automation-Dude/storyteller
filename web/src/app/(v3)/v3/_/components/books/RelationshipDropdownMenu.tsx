"use client"

import { IconCheck, IconMinus, IconX } from "@tabler/icons-react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useMemo, useRef, useState } from "react"

import { Button } from "@v3/_/components/ui/button"
import { Input } from "@v3/_/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@v3/_/components/ui/popover"
import { Skeleton } from "@v3/_/components/ui/skeleton"
import { Slider } from "@v3/_/components/ui/slider"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import {
  ASSET_FORMATS,
  type AssetFormat,
  type FieldDef,
  MEDIA_TYPE_VALUES,
  type ShelfFilterCondition,
  type ShelfFilterField,
  type ShelfFilterOperator,
  getFieldDef,
  getFieldType,
} from "@/shelves"
import {
  useListCollectionsQuery,
  useListCreatorsQuery,
  useListSeriesQuery,
  useListStatusesQuery,
  useListTagsQuery,
} from "@/store/api"

import { RelationGlyph } from "./RelationChipEditor"
import { FieldIcon } from "./field-icons"

export type FilterControlProps = {
  field: ShelfFilterField
  // all top-level conditions currently targeting this field (the hook owns the
  // tree and slices it by field).
  conditions: ShelfFilterCondition[]
  onChange: (next: ShelfFilterCondition[]) => void
  // a locked seed (e.g. "series is Dune" on a series page) renders read-only.
  locked?: boolean
  // remove this field from the filter entirely (the chip's x).
  onRemove?: () => void
}

type Item = {
  uuid: string
  name: string
  icon?: string | null
  color?: string | null
}

// TODO: remove, localize
const FORMAT_VALUE_LABELS = {
  ebook: "Ebook",
  audiobook: "Audiobook",
  synced: "Readaloud",
  "ebook-only": "Ebook only",
  "audiobook-only": "Audiobook only",
  "missing-readaloud": "Ebook + audiobook, not synced",
  "missing-files": "Missing files",
  "no-media": "No media",
}

const ASSET_FORMAT_LABELS: Record<AssetFormat, string> = {
  ebook: "Ebook",
  audiobook: "Audiobook",
  readaloud: "Readaloud",
}

function facetOperators(field: ShelfFilterField): {
  inc: ShelfFilterOperator
  exc: ShelfFilterOperator
} {
  // array relations use includes/excludes; uuid (status) and enum (format) use
  // the any-of / none-of pair.
  return getFieldType(field) === "array"
    ? { inc: "includes", exc: "excludes" }
    : { inc: "isAnyOf", exc: "isNoneOf" }
}

function readFacet(
  conditions: ShelfFilterCondition[],
  ops: { inc: ShelfFilterOperator; exc: ShelfFilterOperator },
): { inc: string[]; exc: string[] } {
  const find = (op: ShelfFilterOperator) =>
    (conditions.find((c) => c.operator === op)?.value as
      | string[]
      | undefined) ?? []
  return { inc: find(ops.inc), exc: find(ops.exc) }
}

function writeFacet(
  field: ShelfFilterField,
  inc: string[],
  exc: string[],
  ops: { inc: ShelfFilterOperator; exc: ShelfFilterOperator },
  role?: string,
): ShelfFilterCondition[] {
  const out: ShelfFilterCondition[] = []
  const extra = role ? { role } : {}
  if (inc.length)
    out.push({
      type: "condition",
      field,
      operator: ops.inc,
      value: inc,
      ...extra,
    })
  if (exc.length)
    out.push({
      type: "condition",
      field,
      operator: ops.exc,
      value: exc,
      ...extra,
    })
  return out
}

// the tri-state cycle for one item: unselected -> include -> exclude ->
// unselected. used by both single click and shift-range (each item in the range
// advances one stage).
function cycleTriState(
  inc: string[],
  exc: string[],
  uuid: string,
): { inc: string[]; exc: string[] } {
  if (inc.includes(uuid))
    return { inc: inc.filter((x) => x !== uuid), exc: [...exc, uuid] }
  if (exc.includes(uuid)) return { inc, exc: exc.filter((x) => x !== uuid) }
  return { inc: [...inc, uuid], exc }
}

// ---------------------------------------------------------------------------
// facet options fetching: one hook for every source. all list hooks are called
// (rules of hooks) but skipped unless this is the active source and the control
// is enabled (popover open or already-applied values), preserving the
// "only fetch when needed" behaviour without a component per entity.
// ---------------------------------------------------------------------------

function useFacetItems(
  source: FieldDef["source"] | undefined,
  enabled: boolean,
): { items: Item[]; loading: boolean } {
  const tags = useListTagsQuery(undefined, {
    skip: !enabled || source !== "tags",
  })
  const collections = useListCollectionsQuery(undefined, {
    skip: !enabled || source !== "collections",
  })
  const series = useListSeriesQuery(undefined, {
    skip: !enabled || source !== "series",
  })
  const creators = useListCreatorsQuery(undefined, {
    skip: !enabled || source !== "creators",
  })
  const statuses = useListStatusesQuery(undefined, {
    skip: !enabled || source !== "statuses",
  })

  const active =
    source === "tags"
      ? tags
      : source === "collections"
        ? collections
        : source === "series"
          ? series
          : source === "creators"
            ? creators
            : source === "statuses"
              ? statuses
              : undefined

  const items = useMemo<Item[]>(
    () =>
      (active?.data ?? []).map((d: Item) => ({
        uuid: d.uuid,
        name: d.name,
        icon: d.icon,
        color: d.color,
      })),
    [active?.data],
  )

  return { items, loading: !!active?.isLoading }
}

// ---------------------------------------------------------------------------
// chip trigger
// ---------------------------------------------------------------------------

function summarize(
  def: FieldDef,
  field: ShelfFilterField,
  conditions: ShelfFilterCondition[],
): string {
  if (def.control === "facet" || def.control === "format-enum") {
    const { inc, exc } = readFacet(conditions, facetOperators(field))
    const n = inc.length + exc.length
    return n > 0 ? `(${n})` : ""
  }
  const c = conditions[0]
  if (!c) return ""
  if (def.control === "text") return `: ${String(c.value ?? "")}`
  // ranges
  if (Array.isArray(c.value)) {
    const [a, b] = c.value as [number | string, number | string]
    return `: ${fmtBound(def, a)}–${fmtBound(def, b)}`
  }
  if (c.operator === "greaterOrEqual" || c.operator === "after")
    return `: ≥ ${fmtBound(def, c.value as number | string)}`
  return `: ≤ ${fmtBound(def, c.value as number | string)}`
}

function fmtBound(def: FieldDef, v: number | string): string {
  if (def.control === "date-range") return String(v)
  const u = unitDisplay(def.scale?.unit)
  return `${u.to(Number(v))}${u.suffix}`
}

export function FilterControl({
  field,
  conditions,
  onChange,
  locked = false,
  onRemove,
}: FilterControlProps) {
  const def = getFieldDef(field)
  const tLabel = useTranslation("Fields.label")
  const [open, setOpen] = useState(false)

  // labelKey is a registry string; the keys are exactly the Fields.label keys.
  const label = tLabel(def.labelKey as Parameters<typeof tLabel>[0])
  const summary = summarize(def, field, conditions)
  const active = conditions.length > 0

  if (locked) {
    return (
      <span className="border-border bg-muted text-muted-foreground inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
        {label}
        {summary}
      </span>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-full border text-xs font-medium",
          active
            ? "border-primary/30 bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground border-transparent",
        )}
      >
        <PopoverTrigger
          render={
            <button className="flex cursor-pointer items-center gap-1 py-1 pr-1 pl-2.5">
              <FieldIcon field={field} className="h-3 w-3" />
              {label}
              {summary}
            </button>
          }
        />
        {active && onRemove && (
          <button
            aria-label={`Remove ${label} filter`}
            className="hover:text-foreground cursor-pointer py-1 pr-2 pl-1"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <IconX className="h-3 w-3" />
          </button>
        )}
      </span>
      <PopoverContent align="start" className="w-72 p-0">
        <FilterEditor
          field={field}
          def={def}
          conditions={conditions}
          onChange={onChange}
          enabled={open}
        />
      </PopoverContent>
    </Popover>
  )
}

// dispatch to the right editor for the field's control type. exported so the
// "Add filter" fan-out menu can render the same editor inline in a submenu.
export function FilterEditor({
  field,
  def,
  conditions,
  onChange,
  enabled,
}: {
  field: ShelfFilterField
  def: FieldDef
  conditions: ShelfFilterCondition[]
  onChange: (next: ShelfFilterCondition[]) => void
  enabled: boolean
}) {
  if (def.control === "facet") {
    return (
      <FacetEditor
        field={field}
        def={def}
        conditions={conditions}
        onChange={onChange}
        enabled={enabled}
      />
    )
  }
  if (def.control === "format-enum") {
    return (
      <FacetEditor
        field={field}
        def={def}
        conditions={conditions}
        onChange={onChange}
        enabled={enabled}
        staticItems={MEDIA_TYPE_VALUES.map((v) => ({
          uuid: v,
          name: FORMAT_VALUE_LABELS[v] ?? v,
        }))}
      />
    )
  }
  if (def.control === "text") {
    return (
      <TextEditor field={field} conditions={conditions} onChange={onChange} />
    )
  }
  if (def.control === "date-range") {
    return (
      <DateRangeEditor
        field={field}
        conditions={conditions}
        onChange={onChange}
      />
    )
  }
  // number-range / duration-range
  return (
    <NumberRangeEditor
      field={field}
      def={def}
      conditions={conditions}
      onChange={onChange}
    />
  )
}

// ---------------------------------------------------------------------------
// facet editor (virtualized, tri-state, shift-range, select/deselect all)
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 32

function FacetEditor({
  field,
  def,
  conditions,
  onChange,
  enabled,
  staticItems,
}: {
  field: ShelfFilterField
  def: FieldDef
  conditions: ShelfFilterCondition[]
  onChange: (next: ShelfFilterCondition[]) => void
  enabled: boolean
  staticItems?: Item[]
}) {
  const t = useTranslation("BooksPage")
  const fetched = useFacetItems(staticItems ? undefined : def.source, enabled)
  const items = staticItems ?? fetched.items
  const loading = staticItems ? false : fetched.loading

  const ops = facetOperators(field)
  const { inc, exc } = readFacet(conditions, ops)
  const role = conditions[0]?.role

  const [search, setSearch] = useState("")
  const filtered = useMemo(
    () =>
      search
        ? items.filter((i) =>
            i.name.toLowerCase().includes(search.toLowerCase()),
          )
        : items,
    [items, search],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<number | null>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  const apply = (nextInc: string[], nextExc: string[]) => {
    onChange(writeFacet(field, nextInc, nextExc, ops, role))
  }

  const clickItem = (index: number, shift: boolean) => {
    const anchor = anchorRef.current
    if (shift && anchor != null) {
      const a = Math.min(anchor, index)
      const b = Math.max(anchor, index)
      let ni = inc
      let ne = exc
      for (let i = a; i <= b; i++) {
        const it = filtered[i]
        if (!it) continue
        const r = cycleTriState(ni, ne, it.uuid)
        ni = r.inc
        ne = r.exc
      }
      apply(ni, ne)
    } else {
      const it = filtered[index]
      if (it) {
        const r = cycleTriState(inc, exc, it.uuid)
        apply(r.inc, r.exc)
      }
    }
    anchorRef.current = index
  }

  const stateOf = (uuid: string): "include" | "exclude" | null =>
    inc.includes(uuid) ? "include" : exc.includes(uuid) ? "exclude" : null

  return (
    <div className="flex flex-col">
      <div className="p-1.5">
        <Input
          autoFocus
          placeholder={t("filters.search")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
          }}
          className="h-8"
        />
      </div>

      <div ref={scrollRef} className="max-h-64 overflow-y-auto px-1">
        {loading ? (
          <div className="space-y-1 p-1">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-muted-foreground p-3 text-center text-xs">
            {t("filters.search")}
          </div>
        ) : (
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const item = filtered[row.index]
              if (!item) return null
              const state = stateOf(item.uuid)
              return (
                <button
                  key={item.uuid}
                  onClick={(e) => {
                    clickItem(row.index, e.shiftKey)
                  }}
                  className="hover:bg-accent absolute top-0 left-0 flex w-full items-center gap-2 rounded-sm px-2 text-left text-sm"
                  style={{
                    height: ROW_HEIGHT,
                    transform: `translateY(${row.start}px)`,
                  }}
                >
                  <RelationGlyph item={item} />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <span className="flex w-4 shrink-0 items-center justify-center">
                    {state === "include" ? (
                      <IconCheck className="text-primary h-4 w-4" />
                    ) : state === "exclude" ? (
                      <IconMinus className="text-destructive h-4 w-4" />
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="border-border flex items-center justify-between border-t p-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            apply(
              filtered.map((i) => i.uuid),
              [],
            )
          }}
        >
          Select all
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          disabled={!inc.length && !exc.length}
          onClick={() => {
            apply([], [])
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  )
}

type ScaleUnit = NonNullable<FieldDef["scale"]>["unit"]

function unitDisplay(unit: ScaleUnit): {
  to: (raw: number) => number
  from: (display: number) => number
  suffix: string
  step: number
} {
  switch (unit) {
    case "bytes":
      return {
        to: (v) => Math.round(v / 1e6),
        from: (v) => v * 1e6,
        suffix: "MB",
        step: 1,
      }
    case "seconds":
      return {
        to: (v) => Math.round((v / 3600) * 10) / 10,
        from: (v) => Math.round(v * 3600),
        suffix: "h",
        step: 0.5,
      }
    case "ratio":
      return {
        to: (v) => Math.round(v * 100),
        from: (v) => v / 100,
        suffix: "%",
        step: 1,
      }
    default:
      return { to: (v) => v, from: (v) => v, suffix: "", step: 1 }
  }
}

// read the [lo, hi] bounds (raw units, either may be null) out of the field's
// single range condition.
function readRange(conditions: ShelfFilterCondition[]): {
  lo: number | null
  hi: number | null
} {
  const c = conditions[0]
  if (!c) return { lo: null, hi: null }
  if (c.operator === "between" && Array.isArray(c.value))
    return { lo: Number(c.value[0]), hi: Number(c.value[1]) }
  if (c.operator === "greaterOrEqual") return { lo: Number(c.value), hi: null }
  if (c.operator === "lessOrEqual") return { lo: null, hi: Number(c.value) }
  return { lo: null, hi: null }
}

function writeRange(
  field: ShelfFilterField,
  lo: number | null,
  hi: number | null,
  format?: AssetFormat,
): ShelfFilterCondition[] {
  const base = {
    type: "condition" as const,
    field,
    ...(format ? { format } : {}),
  }
  if (lo != null && hi != null)
    return [{ ...base, operator: "between", value: [lo, hi] }]
  if (lo != null) return [{ ...base, operator: "greaterOrEqual", value: lo }]
  if (hi != null) return [{ ...base, operator: "lessOrEqual", value: hi }]
  return []
}

function NumberRangeEditor({
  field,
  def,
  conditions,
  onChange,
}: {
  field: ShelfFilterField
  def: FieldDef
  conditions: ShelfFilterCondition[]
  onChange: (next: ShelfFilterCondition[]) => void
}) {
  const u = unitDisplay(def.scale?.unit)
  const { lo, hi } = readRange(conditions)
  const format = conditions.at(0)?.format

  const set = (nextLo: number | null, nextHi: number | null, fmt = format) => {
    onChange(writeRange(field, nextLo, nextHi, fmt))
  }

  const sliderBounds =
    def.scale && def.scale.min != null && def.scale.max != null
      ? {
          min: def.scale.min,
          max: def.scale.max,
          step: def.scale.step ?? u.step,
        }
      : null
  const dispLo = lo == null ? "" : String(u.to(lo))
  const dispHi = hi == null ? "" : String(u.to(hi))

  return (
    <div className="flex flex-col gap-3 p-3">
      {def.discriminator === "format" && (
        <div className="flex flex-wrap gap-1">
          {(["any", ...ASSET_FORMATS] as const).map((f) => {
            const value = f === "any" ? undefined : f
            const selected = format === value
            return (
              <button
                key={f}
                onClick={() => {
                  set(lo, hi, value)
                }}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs",
                  selected
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground border-transparent",
                )}
              >
                {f === "any" ? "Any" : ASSET_FORMAT_LABELS[f]}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          placeholder="Min"
          step={u.step}
          value={dispLo}
          onChange={(e) => {
            set(
              e.target.value === "" ? null : u.from(Number(e.target.value)),
              hi,
            )
          }}
          className="h-8"
        />
        <span className="text-muted-foreground text-xs">–</span>
        <Input
          type="number"
          inputMode="decimal"
          placeholder="Max"
          step={u.step}
          value={dispHi}
          onChange={(e) => {
            set(
              lo,
              e.target.value === "" ? null : u.from(Number(e.target.value)),
            )
          }}
          className="h-8"
        />
        {u.suffix && (
          <span className="text-muted-foreground text-xs">{u.suffix}</span>
        )}
      </div>

      {sliderBounds && (
        <Slider
          secondThumb
          thumbAlignment="edge-client-only"
          className="[&_[data-slot='slider-indicator']]:bg-primary/70 [&_[data-slot='slider-thumb']]:border-primary/70"
          min={sliderBounds.min}
          max={sliderBounds.max}
          step={sliderBounds.step}
          defaultValue={[lo ?? sliderBounds.min, hi ?? sliderBounds.max]}
          onValueCommitted={(v) => {
            const arr = (Array.isArray(v) ? v : [v]) as number[]
            set(arr[0] ?? null, arr[1] ?? null)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// date range editor (from / to date inputs)
// ---------------------------------------------------------------------------

function readDateRange(conditions: ShelfFilterCondition[]): {
  from: string
  to: string
} {
  const c = conditions[0]
  if (!c) return { from: "", to: "" }
  if (c.operator === "between" && Array.isArray(c.value))
    return { from: String(c.value[0]), to: String(c.value[1]) }
  if (c.operator === "after") return { from: String(c.value), to: "" }
  if (c.operator === "before") return { from: "", to: String(c.value) }
  return { from: "", to: "" }
}

function writeDateRange(
  field: ShelfFilterField,
  from: string,
  to: string,
): ShelfFilterCondition[] {
  if (!from && !to) return []
  if (from && to)
    return [
      { type: "condition", field, operator: "between", value: [from, to] },
    ]
  if (from)
    return [{ type: "condition", field, operator: "after", value: from }]
  return [{ type: "condition", field, operator: "before", value: to }]
}

function DateRangeEditor({
  field,
  conditions,
  onChange,
}: {
  field: ShelfFilterField
  conditions: ShelfFilterCondition[]
  onChange: (next: ShelfFilterCondition[]) => void
}) {
  const { from, to } = readDateRange(conditions)
  return (
    <div className="flex items-center gap-2 p-3">
      <Input
        type="date"
        value={from}
        onChange={(e) => {
          onChange(writeDateRange(field, e.target.value, to))
        }}
        className="h-8"
      />
      <span className="text-muted-foreground text-xs">–</span>
      <Input
        type="date"
        value={to}
        onChange={(e) => {
          onChange(writeDateRange(field, from, e.target.value))
        }}
        className="h-8"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// text editor (contains)
// ---------------------------------------------------------------------------

function TextEditor({
  field,
  conditions,
  onChange,
}: {
  field: ShelfFilterField
  conditions: ShelfFilterCondition[]
  onChange: (next: ShelfFilterCondition[]) => void
}) {
  const value = String(conditions[0]?.value ?? "")
  return (
    <div className="p-3">
      <Input
        autoFocus
        value={value}
        placeholder="Contains…"
        onChange={(e) => {
          onChange(
            e.target.value
              ? [
                  {
                    type: "condition",
                    field,
                    operator: "contains",
                    value: e.target.value,
                  },
                ]
              : [],
          )
        }}
        className="h-8"
      />
    </div>
  )
}
