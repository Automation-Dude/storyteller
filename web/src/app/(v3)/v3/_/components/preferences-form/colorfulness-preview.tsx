"use client"

import { cn } from "@v3/_/lib/utils"

import { type ColorMode } from "@/database/userPreferencesTypes"

// a representative cover color so the preview reads the same for everyone,
// independent of any real book
const SAMPLE = { r: 37, g: 99, b: 235 }
const solid = `rgb(${SAMPLE.r}, ${SAMPLE.g}, ${SAMPLE.b})`
const alpha = (a: number) => `rgba(${SAMPLE.r}, ${SAMPLE.g}, ${SAMPLE.b}, ${a})`

// mirrors how the real book components gate cover-color usage, so the preview
// matches what the setting actually does
export function ColorfulnessPreview({
  level,
  intensity,
}: {
  level: ColorMode
  intensity: number
}) {
  const showTint = level !== "minimal"
  const showAccent = level === "full"
  const tint = (base: number) =>
    showTint ? alpha(base * intensity) : undefined

  return (
    <div className="flex items-end gap-4">
      {/* a grid card */}
      <div className="w-28 shrink-0">
        <div
          className="bg-muted flex aspect-13/16 items-center justify-center rounded-lg p-2"
          style={{ background: tint(0.36) }}
        >
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
            className="text-[0.8rem] leading-tight font-medium"
            style={{ color: showAccent ? solid : undefined }}
          >
            Sample title
          </p>
        </div>
      </div>

      {/* a details panel snippet */}
      <div className="border-border w-36 shrink-0 overflow-hidden rounded-lg border">
        <div
          className="flex h-7 items-center px-2 text-[0.7rem]"
          style={{
            background: tint(0.5),
            color: showAccent ? solid : undefined,
          }}
        >
          Details
        </div>
        <div className="space-y-1 p-2">
          <div className="bg-muted-foreground/20 h-1.5 w-full rounded-full" />
          <div className="bg-muted-foreground/20 h-1.5 w-2/3 rounded-full" />
          <div
            className={cn(
              "mt-2 inline-flex h-5 items-center rounded-md px-2 text-[0.65rem] font-medium text-white",
            )}
            style={{ background: showAccent ? solid : "var(--primary)" }}
          >
            Read
          </div>
        </div>
      </div>
    </div>
  )
}
