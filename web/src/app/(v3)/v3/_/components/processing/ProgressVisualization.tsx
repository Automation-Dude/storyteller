"use client"

import { useReducedMotion } from "motion/react"

import { cn } from "@v3/_/lib/utils"

import { type ProcessingView, overallProgress } from "./shared"

const SEGMENTS = 16

// the concept: a straight bar splits into tilted chunks (pre-processing), an orange
// burn sweeps across them (transcribing), then they realign to a flat solid bar
// (synchronizing) and settle (done). state is derived from stage + progress, so the
// motion mirrors real progress rather than running on a timer.
export function ProgressVisualization({
  view,
  className,
}: {
  view: ProcessingView
  className?: string
}) {
  const reduce = useReducedMotion()
  const { stage, stageProgress, status } = view

  if (reduce) {
    return <StaticProgressBar view={view} className={className} />
  }

  const splitT = stage === "SPLIT_TRACKS" ? stageProgress : stage ? 1 : 0
  const syncT = stage === "SYNC_CHAPTERS" ? stageProgress : 0
  const burnT =
    stage === "TRANSCRIBE_CHAPTERS"
      ? stageProgress
      : stage === "SYNC_CHAPTERS" || status === "done"
        ? 1
        : 0

  return (
    <div
      className={cn(
        "flex h-8 items-center justify-center gap-[14px]",
        status === "paused" && "opacity-50",
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: SEGMENTS }).map((_, i) => {
        const fraction = i / (SEGMENTS - 1)
        const baseTilt = (i % 2 === 0 ? 1 : -1) * 50
        const realigned = syncT > 0 && fraction <= syncT
        const tilt = realigned ? 90 : 90 - baseTilt * splitT * (1 - syncT)
        const burned = fraction <= burnT
        console.log(
          `${i} ${fraction} ${baseTilt} ${realigned} ${tilt} ${burned} ${status} ${burnT}`,
        )

        const color =
          status === "error"
            ? "var(--destructive)"
            : status === "done" || realigned
              ? "var(--primary)"
              : burned
                ? "#f97316" // orange burn
                : "var(--muted-foreground)"

        const lit = burned || status === "done" || realigned

        return (
          <span
            key={i}
            className="origin-center rounded-full transition-all duration-500 ease-out motion-reduce:transition-none"
            style={{
              width: 3,
              height: lit ? 16 : 16,
              transform: `rotate(${tilt}deg)`,
              backgroundColor: color,
              opacity: lit ? 1 : 0.5,
              transitionDelay: `${i * 12}ms`,
            }}
          />
        )
      })}
    </div>
  )
}

export function StaticProgressBar({
  view,
  className,
}: {
  view: ProcessingView
  className?: string
}) {
  const pct = Math.round(overallProgress(view) * 100)
  const tint =
    view.status === "error"
      ? "bg-destructive"
      : view.status === "done"
        ? "bg-primary"
        : "bg-primary"

  return (
    <div
      className={cn(
        "bg-muted h-2 w-full overflow-hidden rounded-full",
        view.status === "paused" && "opacity-50",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full", tint)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
