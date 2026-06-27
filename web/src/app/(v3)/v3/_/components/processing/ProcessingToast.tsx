"use client"

import {
  IconChevronDown,
  IconChevronUp,
  IconLoader2,
  IconPlayerPause,
  IconPlayerPlay,
  IconX,
} from "@tabler/icons-react"
import { useState } from "react"

import { Button } from "@v3/_/components/ui/button"
import { V3Link } from "@v3/_/components/v3-link"
import { cn } from "@v3/_/lib/utils"

import {
  useCancelJobMutation,
  useGetJobsQuery,
  usePauseJobMutation,
  useResumeJobMutation,
} from "@/store/api"

import { ProgressVisualization } from "./ProgressVisualization"
import { STAGE_LABELS, jobToView, overallProgress } from "./shared"
import { TooltipButton } from "../ui/tooltip-button"

// a persistent, minimizable processing indicator. lives in the authenticated app
// layout so it stays visible while jobs run, across navigation. driven by the jobs
// query (live via the job event stream).
export function ProcessingToast() {
  const { data: jobs } = useGetJobsQuery(undefined, {
    // poll as a fallback in case the event stream drops; events still drive most updates.
    pollingInterval: 3000,
  })
  const [cancelJob] = useCancelJobMutation()
  const [pauseJob] = usePauseJobMutation()
  const [resumeJob] = useResumeJobMutation()
  const [minimized, setMinimized] = useState(false)

  const active = (jobs ?? []).filter(
    (j) =>
      j.status === "RUNNING" || j.status === "QUEUED" || j.status === "PAUSED",
  )

  const current = active.find((j) => j.status === "RUNNING") ?? active[0]
  if (!current) return null

  const view = jobToView(current)
  const pct = Math.round(overallProgress(view) * 100)
  const queuedCount = active.length - 1

  const headline =
    current.status === "PAUSED"
      ? "Paused"
      : view.stage
        ? STAGE_LABELS[view.stage]
        : current.status === "QUEUED"
          ? "Queued"
          : "Processing"

  return (
    <div className="fixed right-4 bottom-4 z-[60] w-[340px] max-w-[calc(100vw-2rem)]">
      <div className="bg-popover text-popover-foreground rounded-[var(--radius)] border shadow-lg">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <IconLoader2
              className={cn(
                "text-primary size-4 shrink-0",
                current.status !== "PAUSED" && "animate-spin",
              )}
            />
            {current.bookTitle ? (
              <V3Link
                href={`/books/${current.bookUuid}`}
                className="hover:text-primary truncate text-sm font-medium hover:underline"
              >
                {current.bookTitle}
              </V3Link>
            ) : (
              <span className="truncate text-sm font-medium">Processing</span>
            )}
          </div>
          <button
            type="button"
            aria-label={minimized ? "Expand" : "Minimize"}
            className="text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => {
              setMinimized((m) => !m)
            }}
          >
            {minimized ? (
              <IconChevronUp className="size-4" />
            ) : (
              <IconChevronDown className="size-4" />
            )}
          </button>
        </div>

        {!minimized && (
          <div className="flex flex-col gap-2 px-3 pb-3">
            <ProgressVisualization view={view} />

            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>
                {headline}
                {current.config?.language
                  ? ` · ${current.config.language}`
                  : ""}
              </span>
              <span>{pct}%</span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <V3Link
                href="/settings?tab=queue"
                className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
              >
                {queuedCount > 0
                  ? `Manage queue · +${queuedCount} more`
                  : "Manage queue"}
              </V3Link>
              <div className="flex items-center gap-2">
                {current.status === "RUNNING" ? (
                  <TooltipButton
                    tooltipClassName="z-[100]"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => void pauseJob({ uuid: current.uuid })}
                    tooltip="Pause job"
                    aria-label="Pause job"
                  >
                    <IconPlayerPause className="size-3" />
                  </TooltipButton>
                ) : null}
                {current.status === "PAUSED" ? (
                  <TooltipButton
                    tooltipClassName="z-[100]"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => void resumeJob({ uuid: current.uuid })}
                    tooltip="Resume job"
                    aria-label="Resume job"
                  >
                    <IconPlayerPlay className="size-3" />
                  </TooltipButton>
                ) : null}
                <TooltipButton
                  tooltipClassName="z-[100]"
                  variant="ghost-destructive"
                  className="h-7 px-2"
                  onClick={() => void cancelJob({ uuid: current.uuid })}
                  tooltip="Cancel job"
                  aria-label="Cancel job"
                >
                  <IconX className="size-3" />
                </TooltipButton>
              </div>
            </div>
          </div>
        )}

        {minimized && (
          <div className="px-3 pb-2">
            <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
