"use client"

import {
  IconBook,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconFileText,
  IconPlayerPause,
  IconPlayerPlay,
  IconX,
} from "@tabler/icons-react"
import { formatDistanceToNow } from "date-fns"
import { useEffect, useState } from "react"

import { Button } from "@v3/_/components/ui/button"
import { Input } from "@v3/_/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@v3/_/components/ui/item"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v3/_/components/ui/select"

import { StaticProgressBar } from "@/app/(v3)/v3/_/components/processing/ProgressVisualization"
import {
  STAGE_LABELS,
  jobToView,
  overallProgress,
} from "@/app/(v3)/v3/_/components/processing/shared"
import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import { V3Link } from "@/app/(v3)/v3/_/components/v3-link"
import { type PublicJob } from "@/database/jobs"
import {
  getCoverUrl,
  useCancelJobMutation,
  useGetJobsQuery,
  usePauseJobMutation,
  useReorderJobsMutation,
  useResumeJobMutation,
} from "@/store/api"
import { type UUID } from "@/uuid"

const PAGE_SIZE = 10

// compound sort options fold the order direction into the choice for a simpler ui.
const SORT_OPTIONS = {
  recent: { sort: "finishedAt", order: "desc", label: "Recently finished" },
  oldest: { sort: "finishedAt", order: "asc", label: "Oldest first" },
  title: { sort: "title", order: "asc", label: "Title A–Z" },
  status: { sort: "status", order: "asc", label: "Status" },
} as const

type SortKey = keyof typeof SORT_OPTIONS

export function QueueTab() {
  const { data: activeJobs } = useGetJobsQuery({ type: "active" })
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-serif text-lg font-medium">Processing queue</h2>
          <p className="text-muted-foreground text-sm">
            Books currently processing or waiting.
          </p>
        </div>

        {list.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing is processing right now.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((job) => {
              const queuedIndex = queued.findIndex((j) => j.uuid === job.uuid)
              return (
                <JobItem
                  key={job.uuid}
                  job={job}
                  isFirst={queuedIndex <= 0}
                  isLast={queuedIndex >= queued.length - 1}
                  move={move}
                  pauseJob={(uuid) => void pauseJob({ uuid })}
                  resumeJob={(uuid) => void resumeJob({ uuid })}
                  cancelJob={(uuid) => void cancelJob({ uuid })}
                />
              )
            })}
          </div>
        )}
      </div>

      <FinishedJobs />
    </div>
  )
}

function FinishedJobs() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("recent")
  const [page, setPage] = useState(0)

  // debounce the search input so we are not refetching on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 300)
    return () => {
      clearTimeout(id)
    }
  }, [search])

  const { sort, order } = SORT_OPTIONS[sortKey]
  const { data: finishedJobs } = useGetJobsQuery(
    {
      type: "finished",
      search: debouncedSearch || undefined,
      sort,
      order,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { pollingInterval: 15000 },
  )

  const jobs = finishedJobs ?? []
  const hasNext = jobs.length === PAGE_SIZE
  const hasPrev = page > 0

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-serif text-lg font-medium">Finished jobs</h2>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by title"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
          }}
          className="h-9 flex-1"
        />
        <Select
          value={sortKey}
          onValueChange={(value) => {
            setSortKey(value as SortKey)
            setPage(0)
          }}
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue>
              {(value: SortKey) => SORT_OPTIONS[value].label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_OPTIONS).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {jobs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No finished jobs.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {jobs.map((job) => (
            <JobItem key={job.uuid} job={job} />
          ))}
        </div>
      )}

      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => {
              setPage((p) => Math.max(p - 1, 0))
            }}
          >
            <IconChevronLeft className="size-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext}
            onClick={() => {
              setPage((p) => p + 1)
            }}
          >
            Next
            <IconChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

const statusStyles: Record<string, string> = {
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
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${statusStyles[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status.toLowerCase()}
    </span>
  )
}

function JobItem({
  job,
  isFirst,
  isLast,
  move,
  pauseJob,
  resumeJob,
  cancelJob,
}: {
  job: PublicJob
  isFirst?: boolean
  isLast?: boolean
  move?: (job: PublicJob, direction: -1 | 1) => void
  pauseJob?: (uuid: UUID) => void
  resumeJob?: (uuid: UUID) => void
  cancelJob?: (uuid: UUID) => void
}) {
  const view = jobToView(job)
  const pct = Math.round(overallProgress(view) * 100)
  const stageLabel = view.stage ? STAGE_LABELS[view.stage] : null
  const isActive = job.status === "RUNNING" || job.status === "PAUSED"

  const detail =
    job.status === "RUNNING" && stageLabel
      ? `${stageLabel} · ${pct}%`
      : job.status === "QUEUED"
        ? "Waiting"
        : job.status === "PAUSED"
          ? "Paused"
          : job.finishedAt
            ? `Finished ${formatDistanceToNow(new Date(job.finishedAt), { addSuffix: true })}`
            : job.status.toLowerCase()

  const configSummary = [
    job.config?.transcriptionEngine,
    job.config?.whisperModel,
    job.config?.language,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <Item variant="outline" className="items-start">
      <ItemMedia variant="image" className="self-center">
        {job.bookUuid ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getCoverUrl(job.bookUuid, {
              width: 64,
              height: 64,
              updatedAt: job.updatedAt,
            })}
            alt=""
          />
        ) : (
          <div className="bg-muted flex size-full items-center justify-center">
            <IconBook className="text-muted-foreground size-4" />
          </div>
        )}
      </ItemMedia>

      <ItemContent>
        <ItemTitle className="max-w-full">
          <V3Link
            href={`/books/${job.bookUuid}`}
            className="hover:text-primary truncate hover:underline"
          >
            {job.bookTitle ?? "Untitled"}
          </V3Link>
          <StatusBadge status={job.status} />
        </ItemTitle>
        <ItemDescription>
          {detail}
          {configSummary ? ` · ${configSummary}` : ""}
          {job.error ? ` · ${job.error}` : ""}
        </ItemDescription>
        {isActive && (
          <StaticProgressBar view={view} className="mt-1.5 max-w-xs" />
        )}
      </ItemContent>

      <ItemActions>
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
              aria-label="Move down"
              tooltip="Move down"
              delay={500}
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
              resumeJob(job.uuid)
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
              pauseJob(job.uuid)
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
              cancelJob(job.uuid)
            }}
          >
            <IconX className="size-4" />
          </TooltipButton>
        ) : null}

        {job.status === "DONE" && job.bookUuid ? (
          <TooltipButton
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="View alignment report"
            tooltip="Alignment report"
            render={<V3Link href={`/books/${job.bookUuid}/alignment`} />}
          >
            <IconFileText className="size-4" />
          </TooltipButton>
        ) : null}
      </ItemActions>
    </Item>
  )
}
