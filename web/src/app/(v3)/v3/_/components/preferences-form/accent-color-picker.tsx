"use client"

import { IconCheck } from "@tabler/icons-react"

import { cn } from "@v3/_/lib/utils"

// the visual for the "default" swatch (null value) — storyteller orange
const DEFAULT_SWATCH = "#eb722f"

const PRESETS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
] as const

function Swatch({
  color,
  selected,
  onClick,
  label,
}: {
  color: string
  selected: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "ring-offset-background flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110",
        selected && "ring-foreground/40 ring-2 ring-offset-2",
      )}
      style={{ background: color }}
    >
      {selected && (
        <IconCheck className="size-4 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
      )}
    </button>
  )
}

export function AccentColorPicker({
  value,
  onChange,
  defaultLabel,
  customLabel,
}: {
  value: string | null
  onChange: (value: string | null) => void
  defaultLabel: string
  customLabel: string
}) {
  // a value not in the preset list (and not null) is treated as custom
  const isPreset = value !== null && PRESETS.includes(value as never)
  const customValue = !isPreset && value !== null ? value : DEFAULT_SWATCH

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Swatch
        color={DEFAULT_SWATCH}
        selected={value === null}
        onClick={() => {
          onChange(null)
        }}
        label={defaultLabel}
      />

      <span className="bg-border mx-1 h-6 w-px" aria-hidden />

      {PRESETS.map((preset) => (
        <Swatch
          key={preset}
          color={preset}
          selected={value === preset}
          onClick={() => {
            onChange(preset)
          }}
          label={preset}
        />
      ))}

      <label
        className={cn(
          "ring-offset-background relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full transition-transform hover:scale-110",
          !isPreset &&
            value !== null &&
            "ring-foreground/40 ring-2 ring-offset-2",
        )}
        style={{
          background:
            "conic-gradient(red, orange, yellow, lime, aqua, blue, magenta, red)",
        }}
        title={customLabel}
      >
        <input
          type="color"
          value={customValue}
          onChange={(e) => {
            onChange(e.target.value)
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={customLabel}
        />
      </label>
    </div>
  )
}
