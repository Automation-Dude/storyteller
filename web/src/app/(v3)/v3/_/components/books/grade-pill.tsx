import { cn } from "@v3/_/lib/utils"

// the analyzer's grade colour ramp, mapped to tailwind. green = strong
// alignment through red = failing, with light/dark variants.
const GRADE_STYLES: Record<string, string> = {
  "A+": "bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-200",
  A: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200",
  "A-": "bg-cyan-200 text-cyan-900 dark:bg-cyan-900 dark:text-cyan-200",
  B: "bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-200",
  "B-": "bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200",
  C: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100",
  D: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  F: "bg-red-100 text-red-800 italic dark:bg-red-900 dark:text-red-200",
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
