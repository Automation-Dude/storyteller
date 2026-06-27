"use client"

import {
  IconChevronDown,
  IconChevronUp,
  IconPlayerPause,
  IconPlayerPlay,
  IconX,
} from "@tabler/icons-react"
import { formatDistanceToNow } from "date-fns"

import { Button } from "@v3/_/components/ui/button"

import {
  STAGE_LABELS,
  jobToView,
  overallProgress,
} from "@/app/(v3)/v3/_/components/processing/shared"
import { V3Link } from "@/app/(v3)/v3/_/components/v3-link"
import { type PublicJob } from "@/database/jobs"
import {
  useCancelJobMutation,
  useGetJobsQuery,
  usePauseJobMutation,
  useReorderJobsMutation,
  useResumeJobMutation,
} from "@/store/api"
import { StaticProgressBar } from "../processing/ProgressVisualization"
import { TooltipButton } from "../ui/tooltip-button"

export function QueueTab() {
  const { data: activeJobs } = useGetJobsQuery(
    { type: "active" },
    {
      pollingInterval: 15000,
    },
  )
  const { data: finishedJobs } = useGetJobsQuery(
    { type: "finished" },
    { pollingInterval: 15000 },
  )
  const [cancelJob] = useCancelJobMutation()
  const [pauseJob] = usePauseJobMutation()
  const [resumeJob] = useResumeJobMutation()
  const [reorderJobs] = useReorderJobsMutation()

  const list = activeJobs ?? []
  const queued = list.filter((j) => j.status === "QUEUED")

  // move a queued job within the queued order, then persist the new order.
  function move(job: PublicJob, direction: -1 | 1) {
    const index = queued.findIndex((j) => j.uuid === job.uuid)
    const target = index + direction
    if (index < 0 || target < 0 || target >= queued.length) return
    const next = [...queued]
    const [removed] = next.splice(index, 1)
    if (!removed) return
    next.splice(target, 0, removed)
    void reorderJobs({ order: next.map((j) => j.uuid) })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-serif text-lg font-medium">Processing queue</h2>
        <p className="text-muted-foreground text-sm">
          Books currently processing or waiting.
        </p>
      </div>
      <div className="space-y-2">
        {list.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Nothing is processing right now.
          </p>
        )}

        {list.map((job) => {
          const queuedIndex = queued.findIndex((j) => j.uuid === job.uuid)
          return (
            <JobItem
              key={job.uuid}
              job={job}
              isLast={queuedIndex >= queued.length - 1}
              isFirst={queuedIndex <= 0}
              move={move}
              resumeJob={resumeJob}
              pauseJob={pauseJob}
              cancelJob={cancelJob}
            />
          )
        })}
      </div>
      <div className="space-y-2">
        <h2 className="text-md font-serif">Finished jobs</h2>
        {finishedJobs?.map((job) => {
          return <JobItem key={job.uuid} job={job} queuedIndex={0} />
        })}
      </div>
    </div>
  )
}

const styles: Record<string, string> = {
  RUNNING: "bg-primary/10 text-primary",
  QUEUED: "bg-muted text-muted-foreground",
  PAUSED: "bg-amber-500/10 text-amber-600",
  ERROR: "bg-destructive/10 text-destructive",
  DONE: "bg-green-500/10 text-green-600",
  CANCELED: "bg-orange-500/10 text-orange-600",
}
function StatusBadge({ status }: { status: PublicJob["status"] }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${styles[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status.toLowerCase()}
    </span>
  )
}

function JobItem({
  job,
  isLast,
  isFirst,
  move,
  resumeJob,
  pauseJob,
  cancelJob,
}: {
  job: PublicJob
  isLast: boolean
  isFirst: boolean
  move?: (job: PublicJob, direction: -1 | 1) => void
  resumeJob?: (job: PublicJob) => void
  pauseJob?: (job: PublicJob) => void
  cancelJob?: (job: PublicJob) => void
}) {
  const view = jobToView(job)
  const pct = Math.round(overallProgress(view) * 100)
  const stageLabel = view.stage ? STAGE_LABELS[view.stage] : null
  // const isQueued = job.status === "QUEUED"

  return (
    <div key={job.uuid} className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <V3Link
              href={`/books/${job.bookUuid}`}
              className="hover:text-primary truncate text-sm font-medium hover:underline"
            >
              {job.bookTitle ?? "Untitled"}
            </V3Link>
            <StatusBadge status={job.status} />
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {job.status === "RUNNING" && stageLabel
              ? `${stageLabel} · ${pct}%`
              : job.status === "QUEUED"
                ? "Waiting"
                : job.status === "PAUSED"
                  ? "Paused"
                  : job.status}
            {job.config?.transcriptionEngine
              ? ` · ${job.config.transcriptionEngine}`
              : ""}
            {job.config?.whisperModel ? ` · ${job.config.whisperModel}` : ""}
            {job.config?.language ? ` · ${job.config.language}` : ""}
            {job.finishedAt
              ? ` · finished ${formatDistanceToNow(new Date(job.finishedAt), { addSuffix: true })}`
              : ""}
            {job.error ? ` · ${job.error}` : ""}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {move && (
            <>
              <TooltipButton
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Move up"
                tooltip="Move up"
                delay={500}
                disabled={isFirst}
                onClick={() => {
                  move(job, -1)
                }}
              >
                <IconChevronUp className="size-4" />
              </TooltipButton>
              <TooltipButton
                variant="ghost"
                size="icon"
                className="size-7"
                tooltip="Move down"
                delay={500}
                aria-label="Move down"
                disabled={isLast}
                onClick={() => {
                  move(job, 1)
                }}
              >
                <IconChevronDown className="size-4" />
              </TooltipButton>
            </>
          )}

          {job.status === "PAUSED" && resumeJob ? (
            <TooltipButton
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Resume"
              tooltip="Resume job"
              onClick={() => {
                resumeJob({ uuid: job.uuid })
              }}
            >
              <IconPlayerPlay className="size-4" />
            </TooltipButton>
          ) : pauseJob ? (
            <TooltipButton
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Pause"
              tooltip="Pause job"
              onClick={() => {
                pauseJob({ uuid: job.uuid })
              }}
            >
              <IconPlayerPause className="size-4" />
            </TooltipButton>
          ) : null}

          {cancelJob ? (
            <TooltipButton
              variant="ghost-destructive"
              size="icon"
              className="size-7"
              aria-label="Cancel"
              tooltip="Cancel job"
              onClick={() => {
                cancelJob({ uuid: job.uuid })
              }}
            >
              <IconX className="size-4" />
            </TooltipButton>
          ) : null}
        </div>
      </div>
      {job.status === "RUNNING" || job.status === "PAUSED" ? (
        <StaticProgressBar
          view={{
            stage: job.stage,
            stageProgress: job.progress,
            status: job.status.toLowerCase() as Lowercase<typeof job.status>,
          }}
        />
      ) : null}
    </div>
  )
}
