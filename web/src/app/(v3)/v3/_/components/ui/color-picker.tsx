"use client"

import { IconX } from "@tabler/icons-react"
import { memo, useState } from "react"

import { cn } from "@v3/_/lib/utils"

import { Button } from "./button"
import { Input } from "./input"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#78716c", // stone
  "#64748b", // slate
]

type ColorPickerProps = {
  value: string | null | undefined
  onChange: (color: string | null) => void
}

export const ColorPicker = memo(function ColorPicker({
  value,
  onChange,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [customColor, setCustomColor] = useState(value ?? "")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-2"
          >
            {value ? (
              <span
                className="size-4 rounded-full border"
                style={{ backgroundColor: value }}
              />
            ) : (
              <span className="text-muted-foreground text-xs">
                Choose color
              </span>
            )}
          </Button>
        }
      />

      <PopoverContent className="w-56 p-3" align="start">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-8 gap-1">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onChange(color)
                  setOpen(false)
                }}
                className={cn(
                  "size-6 rounded-full border-2 transition-transform hover:scale-110",
                  value === color ? "border-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={customColor}
              onChange={(e) => { setCustomColor(e.target.value); }}
              placeholder="#hex"
              className="h-7 flex-1 text-xs"
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  customColor.match(/^#[0-9a-f]{3,8}$/i)
                ) {
                  onChange(customColor)
                  setOpen(false)
                }
              }}
            />

            {value && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  onChange(null)
                  setCustomColor("")
                  setOpen(false)
                }}
              >
                <IconX className="size-3" />
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
})
