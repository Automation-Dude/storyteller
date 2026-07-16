import { cn } from "@v3/_/lib/utils"

// the analyzer's grade colour ramp, mapped to tailwind. green = strong
// alignment through red = failing, with light/dark variants.
const GRADE_STYLES: Record<string, string> = {
  "A+": "bg-positive-bg text-positive dark:bg-positive-900 dark:text-positive-200",
  A: "bg-good-bg text-good dark:bg-good-900 dark:text-good-200",
  "A-": "bg-good-bg text-good dark:bg-good-900 dark:text-good-200",
  B: "bg-moderate-bg text-moderate dark:bg-moderate-900 dark:text-moderate-200",
  "B-": "bg-moderate-bg text-moderate dark:bg-moderate-900 dark:text-moderate-200",
  C: "bg-poor-bg text-poor dark:bg-poor-900 dark:text-poor-200",
  D: "bg-poor-bg text-poor dark:bg-poor-900 dark:text-poor-200",
  F: "bg-poor-bg text-poor dark:bg-poor-900 dark:text-poor-200",
}

// the same grade → colour ramp as GRADE_STYLES, as raw css variables so a
// facet colour dot can carry the grade's signature colour. mid-tone oklch that
// reads on both light and dark.
export const GRADE_COLORS: Record<string, string> = {
  "A+": "var(--positive)",
  A: "var(--good)",
  "A-": "var(--good)",
  B: "var(--moderate)",
  "B-": "var(--moderate)",
  C: "var(--poor)",
  D: "var(--poor)",
  F: "var(--poor)",
}

export function GradePill({
  grade,
  className,
}: {
  grade: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-xs font-bold tabular-nums",
        GRADE_STYLES[grade] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {grade}
    </span>
  )
}
