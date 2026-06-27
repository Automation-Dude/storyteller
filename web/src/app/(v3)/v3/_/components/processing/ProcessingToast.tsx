"use client"

import {
  IconBook,
  IconChevronDown,
  IconChevronUp,
  IconDotsVertical,
  IconListNumbers,
  IconLoader2,
  IconPlayerPause,
  IconPlayerPlay,
  IconX,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@v3/_/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@v3/_/components/ui/item"
import { V3Link } from "@v3/_/components/v3-link"
import { useVersionBasePath } from "@v3/_/components/version-context"
import { cn } from "@v3/_/lib/utils"

import { type PublicJob } from "@/database/jobs"
import {
  getCoverUrl,
  useCancelJobMutation,
  useGetJobsQuery,
  usePauseJobMutation,
  useResumeJobMutation,
} from "@/store/api"

import { ProgressVisualization } from "./ProgressVisualization"
import { STAGE_LABELS, jobToView, overallProgress } from "./shared"

// a persistent, minimizable processing indicator. lives in the authenticated app
// layout so it stays visible while jobs run, across navigation. driven by the jobs
// query (live via the job event stream). also announces finished runs.
export function ProcessingToast() {
  const { data: jobs } = useGetJobsQuery(
    { type: "active" },
    // poll as a fallback in case the event stream drops; events drive most updates.
    { pollingInterval: 3000 },
  )
  const { data: finishedJobs } = useGetJobsQuery(
    { type: "finished", limit: 5 },
    { pollingInterval: 5000 },
  )
  const [cancelJob] = useCancelJobMutation()
  const [pauseJob] = usePauseJobMutation()
  const [resumeJob] = useResumeJobMutation()
  const [minimized, setMinimized] = useState(false)
  const [dismissed, setDismissed] = useState<string | null>(null)

  const basePath = useVersionBasePath()
  const router = useRouter()

  useFinishedNotifications(finishedJobs, basePath, router)

  const active = (jobs ?? []).filter(
    (j) =>
      j.status === "RUNNING" || j.status === "QUEUED" || j.status === "PAUSED",
  )

  // ask for notification permission once a run is in progress.
  const askedRef = useRef(false)
  useEffect(() => {
    if (active.length === 0 || askedRef.current) return
    askedRef.current = true
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission()
    }
  }, [active.length])

  const current = active.find((j) => j.status === "RUNNING") ?? active[0]
  if (!current) return null
  if (dismissed === current.uuid) return null

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
    <div className="fixed right-4 bottom-4 z-50 w-[320px] max-w-[calc(100vw-2rem)]">
      <Item
        variant="outline"
        size="sm"
        className="bg-popover text-popover-foreground items-start shadow-lg"
      >
        <ItemMedia variant="image" className="h-18! w-10! object-contain!">
          {current.bookUuid ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={getCoverUrl(current.bookUuid, {
                width: 96,
                height: 64,
                updatedAt: current.updatedAt,
              })}
              alt=""
            />
          ) : (
            <div className="bg-muted flex size-full items-center justify-center">
              <IconBook className="text-muted-foreground size-4" />
            </div>
          )}
        </ItemMedia>

        <ItemContent className="gap-1.5">
          <ItemTitle className="max-w-full">
            <IconLoader2
              className={cn(
                "text-primary size-3.5 shrink-0",
                current.status !== "PAUSED" && "animate-spin",
              )}
            />
            {current.bookUuid ? (
              <V3Link
                href={`/books/${current.bookUuid}`}
                className="hover:text-primary truncate hover:underline"
              >
                {current.bookTitle ?? "Untitled"}
              </V3Link>
            ) : (
              <span className="truncate">Processing</span>
            )}
          </ItemTitle>

          {minimized ? (
            <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : (
            <>
              <ProgressVisualization view={view} percent={pct} />
              <span className="text-muted-foreground text-xs">
                {headline}
                {queuedCount > 0 ? ` · +${queuedCount} queued` : ""}
              </span>
            </>
          )}
        </ItemContent>

        <ItemActions className="gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label="More actions"
                />
              }
            >
              <IconDotsVertical className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50">
              <DropdownMenuItem render={<V3Link href="/settings?tab=queue" />}>
                <IconListNumbers className="size-4" />
                Manage queue
              </DropdownMenuItem>
              {current.status === "RUNNING" && (
                <DropdownMenuItem
                  onClick={() => void pauseJob({ uuid: current.uuid })}
                >
                  <IconPlayerPause className="size-4" />
                  Pause
                </DropdownMenuItem>
              )}
              {current.status === "PAUSED" && (
                <DropdownMenuItem
                  onClick={() => void resumeJob({ uuid: current.uuid })}
                >
                  <IconPlayerPlay className="size-4" />
                  Resume
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void cancelJob({ uuid: current.uuid })}
              >
                <IconX className="size-4" />
                Cancel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={minimized ? "Expand" : "Minimize"}
            onClick={() => {
              setMinimized((m) => !m)
            }}
          >
            {minimized ? (
              <IconChevronUp className="size-3.5" />
            ) : (
              <IconChevronDown className="size-3.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="Dismiss"
            onClick={() => {
              setDismissed(current.uuid)
            }}
          >
            <IconX className="size-3.5" />
          </Button>
        </ItemActions>
      </Item>
    </div>
  )
}

// announce newly finished jobs once: an in-app toast plus, when the tab is hidden
// and permission is granted, a web notification. seeds the seen-set on first load so
// pre-existing history is not announced.
function useFinishedNotifications(
  finishedJobs: PublicJob[] | undefined,
  basePath: string,
  router: ReturnType<typeof useRouter>,
) {
  const seen = useRef<Set<string>>(new Set())
  const seeded = useRef(false)

  useEffect(() => {
    if (!finishedJobs) return

    if (!seeded.current) {
      for (const job of finishedJobs) seen.current.add(job.uuid)
      seeded.current = true
      return
    }

    for (const job of finishedJobs) {
      if (seen.current.has(job.uuid)) continue
      seen.current.add(job.uuid)

      const title = job.bookTitle ?? "A book"
      if (job.status === "DONE") {
        const href = job.bookUuid ? `${basePath}/books/${job.bookUuid}` : null
        toast.success(`${title} is ready`, {
          ...(href && {
            action: {
              label: "Open",
              onClick: () => {
                router.push(href)
              },
            },
          }),
        })
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          typeof document !== "undefined" &&
          document.hidden
        ) {
          const notification = new Notification("Book ready", {
            body: `${title} has finished aligning.`,
          })
          if (href) {
            notification.onclick = () => {
              window.focus()
              router.push(href)
            }
          }
        }
      } else if (job.status === "ERROR") {
        toast.error(`${title} failed to process`, {
          description: job.error ?? undefined,
        })
      }
    }
  }, [finishedJobs, basePath, router])
}
