"use client"

import { cn } from "@v3/_/lib/utils"

import { type ColorMode } from "@/database/userPreferencesTypes"

// a representative cover color so the preview reads the same for everyone,
// independent of any real book
const SAMPLE = { r: 37, g: 99, b: 235 }
const solid = `rgb(${SAMPLE.r}, ${SAMPLE.g}, ${SAMPLE.b})`
const alpha = (a: number) => `rgba(${SAMPLE.r}, ${SAMPLE.g}, ${SAMPLE.b}, ${a})`
const channels = `${SAMPLE.r} ${SAMPLE.g} ${SAMPLE.b}`

// opens a cover-color scope for the sample, exactly as CoverScope does for a
// real book, so the preview resolves the same tokens the book components use
function sampleScope(level: ColorMode, intensity: number) {
  const style: Record<string, string | number> = {
    "--cover-rgb": channels,
    "--cover-solid-rgb": channels,
    "--cover-accent-rgb": channels,
    "--cover-accent-solid-rgb": channels,
    "--cover-intensity": intensity,
  }
  if (level === "full") {
    style["--primary"] = solid
    style["--primary-foreground"] = "#fff"
    style["--cover-accent-color"] = solid
    style["--cover-accent-foreground"] = "#fff"
  }
  return {
    style: style as React.CSSProperties,
    ...(level !== "minimal" ? { "data-cover-tint": "" } : {}),
    ...(level === "full" ? { "data-cover-accent": "" } : {}),
  }
}

// mirrors how the real book components gate cover-color usage, so the preview
// matches what the setting actually does
export function ColorfulnessPreview({
  level,
  intensity,
}: {
  level: ColorMode
  intensity: number
}) {
  return (
    <div className="flex items-end gap-4" {...sampleScope(level, intensity)}>
      {/* a grid card */}
      <div className="w-28 shrink-0">
        <div className="bg-cover-well flex aspect-13/16 items-center justify-center rounded-lg p-2">
          <div
            className="h-full w-3/4 rounded shadow-md"
            style={{
              background: `linear-gradient(145deg, ${solid}, ${alpha(0.7)})`,
            }}
          />
        </div>
        <div className="mt-1.5 space-y-0.5 px-0.5">
          <div className="bg-muted-foreground/30 h-1.5 w-1/2 rounded-full" />
          <p
            className={cn(
              "text-[0.8rem] leading-tight font-medium",
              level === "full" && "text-cover",
            )}
          >
            Sample title
          </p>
        </div>
      </div>

      {/* a details panel snippet */}
      <div className="border-border w-36 shrink-0 overflow-hidden rounded-lg border">
        <div className="bg-cover-header flex h-7 items-center px-2 text-[0.7rem]">
          Details
        </div>
        <div className="space-y-1 p-2">
          <div className="bg-muted-foreground/20 h-1.5 w-full rounded-full" />
          <div className="bg-muted-foreground/20 h-1.5 w-2/3 rounded-full" />
          <div className="bg-primary mt-2 inline-flex h-5 items-center rounded-md px-2 text-[0.65rem] font-medium text-white">
            Read
          </div>
        </div>
      </div>
    </div>
  )
}
