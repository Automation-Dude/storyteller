"use client"

import { useMemo, useState } from "react"

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@v3/_/components/ui/combobox"
import { Input } from "@v3/_/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v3/_/components/ui/select"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type FieldDefNumeric } from "@/fields"

// ---------------------------------------------------------------------------
// the single home for filter value-input primitives + the derived helpers both
// the quick-chip editor (RelationshipDropdownMenu) and the advanced editor
// (ShelfFilterEditor) build on, so neither reinvents scale/unit conversion or
// drifts from FIELD_REGISTRY.
// ---------------------------------------------------------------------------

// unit conversion for a numeric field's raw stored value <-> a human display
// value, driven by the registry scale unit. ONE copy: both editors import this
// so a byte or a second means the same thing everywhere. bytes use the binary
// 1 MiB (1048576) convention, matching FILE_SIZE_MULTIPLIERS below.
export type ScaleUnit = NonNullable<FieldDefNumeric["scale"]>["unit"]

export function unitDisplay(unit: ScaleUnit): {
  to: (raw: number) => number
  from: (display: number) => number
  suffix: string
  step: number
} {
  switch (unit) {
    case "bytes":
      return {
        to: (v) => Math.round(v / 1048576),
        from: (v) => v * 1048576,
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

// ---------------------------------------------------------------------------
// numeric input (type=text + inputMode so the field can be cleared properly)
// ---------------------------------------------------------------------------

export function NumericInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: number | "" | null | undefined
  onChange: (value: number) => void
  className?: string
  placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  const [localValue, setLocalValue] = useState("")

  const displayValue = focused
    ? localValue
    : value === null || value === undefined || value === ""
      ? ""
      : String(value)

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={className}
      value={displayValue}
      onChange={(e) => {
        const raw = e.target.value
        setLocalValue(raw)

        const parsed = Number(raw)
        if (raw !== "" && !isNaN(parsed)) {
          onChange(parsed)
        }
      }}
      onFocus={() => {
        const str =
          value === null || value === undefined || value === ""
            ? ""
            : String(value)

        setLocalValue(str)
        setFocused(true)
      }}
      onBlur={() => {
        setFocused(false)
      }}
      placeholder={placeholder}
    />
  )
}

// ---------------------------------------------------------------------------
// duration input (hours + minutes instead of raw seconds)
// ---------------------------------------------------------------------------

export function DurationInput({
  value,
  onChange,
}: {
  value: number | undefined | null
  onChange: (seconds: number) => void
}) {
  const t = useTranslation("ShelfFilterEditor")
  const totalSeconds = typeof value === "number" ? value : 0
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  return (
    <div className="flex items-center gap-1">
      <NumericInput
        className="h-7 w-14 text-xs"
        value={hours || ""}
        onChange={(h) => {
          onChange(h * 3600 + minutes * 60)
        }}
        placeholder="0"
      />
      <span className="text-muted-foreground text-xs">
        {t.plain("durationHours")}
      </span>

      <NumericInput
        className="h-7 w-14 text-xs"
        value={minutes || ""}
        onChange={(m) => {
          onChange(hours * 3600 + m * 60)
        }}
        placeholder="0"
      />
      <span className="text-muted-foreground text-xs">
        {t.plain("durationMinutes")}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// file size input (with unit selector instead of raw bytes)
// ---------------------------------------------------------------------------

export type FileSizeUnit = "bytes" | "kb" | "mb" | "gb"

export const FILE_SIZE_MULTIPLIERS: Record<FileSizeUnit, number> = {
  bytes: 1,
  kb: 1024,
  mb: 1048576,
  gb: 1073741824,
}

export function detectFileSizeUnit(bytes: number): FileSizeUnit {
  if (bytes >= 1073741824) return "gb"
  if (bytes >= 1048576) return "mb"
  if (bytes >= 1024) return "kb"
  return "bytes"
}

export function FileSizeInput({
  value,
  onChange,
}: {
  value: number | undefined | null
  onChange: (bytes: number) => void
}) {
  const t = useTranslation("ShelfFilterEditor")

  const [unit, setUnit] = useState<FileSizeUnit>(() =>
    typeof value === "number" && value > 0 ? detectFileSizeUnit(value) : "mb",
  )

  const multiplier = FILE_SIZE_MULTIPLIERS[unit]

  const displayValue =
    typeof value === "number"
      ? Math.round((value / multiplier) * 100) / 100
      : ""

  const unitItems = (["bytes", "kb", "mb", "gb"] as const).map((u) => ({
    value: u,
    label: t.plain(`fileSizeUnit.${u}` as "fileSizeUnit.mb"),
  }))

  return (
    <div className="flex items-center gap-1">
      <NumericInput
        className="h-7 w-20 text-xs"
        value={displayValue}
        onChange={(n) => {
          onChange(n * multiplier)
        }}
      />

      <Select
        value={unit}
        onValueChange={(v) => {
          setUnit(v as FileSizeUnit)
        }}
        items={unitItems}
      >
        <SelectTrigger className="h-7 w-16 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {unitItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// shared multi-select combobox (used for tags, collections, media types, etc.)
// ---------------------------------------------------------------------------

export function MultiCombobox({
  options,
  value,
  onChange,
  placeholder,
  emptyText,
}: {
  options: Array<{ value: string; label: string }>
  value: string[]
  onChange: (value: string[]) => void
  placeholder: string
  emptyText: string
}) {
  const labelsByValue = useMemo(
    () => new Map(options.map((o) => [o.value, o.label])),
    [options],
  )

  return (
    <Combobox
      items={options}
      multiple
      value={value}
      onValueChange={onChange}
      filter={(itemValue, query) => {
        const label = labelsByValue.get(itemValue) ?? itemValue
        return label.toLowerCase().includes(query.toLowerCase())
      }}
    >
      <ComboboxChips className="min-h-7">
        <ComboboxValue>
          {options
            .filter((o) => value.includes(o.value))
            .map((o) => (
              <ComboboxChip key={o.value}>{o.label}</ComboboxChip>
            ))}
        </ComboboxValue>
        <ComboboxChipsInput placeholder={placeholder} className="text-xs" />
      </ComboboxChips>

      <ComboboxContent>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {options.map((o) => (
            <ComboboxItem key={o.value} value={o.value}>
              {o.label}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
