"use client"

import {
  IconAlertTriangle,
  IconCheck,
  IconProgress,
  IconX,
} from "@tabler/icons-react"
import { formatDistanceToNow } from "date-fns"
import { useState } from "react"

import { GradePill } from "@v3/_/components/books/grade-pill"
import { Button } from "@v3/_/components/ui/button"
import { useReportPanel } from "@v3/_/hooks/use-report-panel"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { useFormatDate } from "@/app/(v3)/v3/_/lib/date"
import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { type BookWithRelations } from "@/database/books"
import { type PublicJob } from "@/database/jobs"
import { usePermission } from "@/hooks/usePermission"
import {
  useCancelProcessingMutation,
  useGetJobsQuery,
  useProcessBookMutation,
} from "@/store/api"
import { type UUID } from "@/uuid"

import { FilePathRow } from "./FilePathRow"
import { ProcessRunDialog } from "./ProcessRunDialog"
import { ProcessingModal } from "./ProcessingModal"
import { CollapsibleSection } from "./sections/CollapsibleSection"

const PROCESSING_STAGE_LABELS: Record<string, string> = {
  SPLIT_TRACKS: "Pre-processing audio",
  TRANSCRIBE_CHAPTERS: "Transcribing tracks",
  SYNC_CHAPTERS: "Synchronizing chapters",
}

export function TranscriptionStatus({ book }: { book: BookWithRelations }) {
  const [processBook] = useProcessBookMutation()
  const [cancelProcessing] = useCancelProcessingMutation()
  const canProcess = usePermission("bookProcess")
  const [, setReportMode] = useReportPanel()
  // the per-run dialog surfaces the same secret-bearing settings as the settings
  // page, so only offer it to settings admins; others process with global defaults.
  const canConfigure = usePermission("settingsUpdate")

  const [processingModalOpen, setProcessingModalOpen] = useState(false)
  const [runDialogOpen, setRunDialogOpen] = useState(false)

  const beginProcessing = () => {
    if (canConfigure) setRunDialogOpen(true)
    else void processBook({ uuid: book.uuid })
  }

  const hasEbook = book.ebook !== null
  const hasAudiobook = book.audiobook !== null
  const canCreateReadaloud = hasEbook && hasAudiobook && !book.readaloud

  const readaloudStatus = book.readaloud?.status
  const aligned = !!book.readaloud?.filepath
  // const isBusy =
  //   readaloudStatus === "QUEUED" || readaloudStatus === "PROCESSING"

  const t = useTranslation("BookDetailsPage.alignment")

  const formatDate = useFormatDate()
  if (!readaloudStatus && !canCreateReadaloud && !canProcess) {
    return null
  }

  return (
    <CollapsibleSection
      name="alignment"
      title={t("title")}
      icon={<IconProgress className="size-3.5 stroke-[1.5]" />}
      className="mb-3 flex flex-col gap-2"
    >
      {readaloudStatus === "ALIGNED" && (
        <div className="flex items-center gap-2 text-sm">
          <IconCheck className="h-4 w-4 text-green-600" />
          <span>{t("aligned")}</span>
        </div>
      )}

      {readaloudStatus === "QUEUED" && (
        <div className="flex items-center justify-between">
          <span className="text-sm">{t("queued")}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void cancelProcessing({ uuid: book.uuid })}
          >
            <IconX className="mr-1 h-3 w-3" />
            {t("cancel")}
          </Button>
        </div>
      )}

      {readaloudStatus === "PROCESSING" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {PROCESSING_STAGE_LABELS[book.readaloud?.currentStage ?? ""] ??
                t("processing")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void cancelProcessing({ uuid: book.uuid })}
            >
              <IconX className="mr-1 h-3 w-3" />
              {t("cancel")}
            </Button>
          </div>

          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{
                width: `${Math.floor((book.readaloud?.stageProgress ?? 0) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {(readaloudStatus === "ERROR" || readaloudStatus === "STOPPED") && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <IconAlertTriangle className="text-destructive h-4 w-4" />
            <span>
              {readaloudStatus === "ERROR" ? t("error") : t("stopped")}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={beginProcessing}>
            {t("retry")}
          </Button>
        </div>
      )}

      {!readaloudStatus && canCreateReadaloud && (
        <Button variant="outline" size="sm" onClick={beginProcessing}>
          <IconReadaloud className="mr-1 h-4 w-4" />
          {t("createReadaloud")}
        </Button>
      )}

      {!readaloudStatus && !canCreateReadaloud && (
        <span className="text-muted-foreground text-sm">
          {t("unprocessed")}
        </span>
      )}

      {canProcess && (
        <ProcessingModal
          book={book}
          aligned={aligned}
          open={processingModalOpen}
          onOpenChange={setProcessingModalOpen}
        />
      )}

      {canConfigure && (
        <ProcessRunDialog
          book={book}
          open={runDialogOpen}
          onOpenChange={setRunDialogOpen}
        />
      )}

      {book.alignmentGrade && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <GradePill grade={book.alignmentGrade} />
            {book.alignmentScore != null && (
              <span className="text-muted-foreground">
                {Math.round(book.alignmentScore)}% aligned
              </span>
            )}
          </div>
          <button
            type="button"
            className="text-primary text-sm hover:underline"
            onClick={() => void setReportMode(true)}
          >
            View full report
          </button>
        </div>
      )}

      {canProcess && <RecentRuns bookUuid={book.uuid} />}

      {book.alignedAt && (
        <FilePathRow
          label={t("lastAligned")}
          filepath={formatDate(book.alignedAt)}
        />
      )}

      {book.alignedWith && (
        <FilePathRow
          label={t("transcriptionEngine")}
          filepath={book.alignedWith}
        />
      )}

      {book.alignedByStorytellerVersion && (
        <FilePathRow
          label={t("storytellerVersion")}
          filepath={book.alignedByStorytellerVersion}
        />
      )}
    </CollapsibleSection>
  )
}

const RUN_DOT: Record<string, string> = {
  DONE: "bg-green-500",
  ERROR: "bg-destructive",
  CANCELED: "bg-orange-500",
}

// a compact history of the last few finished runs for this book. intentionally
// lighter than the queue tab's JobItem.
function RecentRuns({ bookUuid }: { bookUuid: UUID }) {
  const { data } = useGetJobsQuery({
    type: "finished",
    bookUuid,
    limit: 5,
  })
  if (!data || data.length === 0) return null

  const configSummary = (job: PublicJob) =>
    [
      job.config?.transcriptionEngine,
      job.config?.whisperModel,
      job.config?.language,
    ]
      .filter(Boolean)
      .join(" · ")

  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <span className="text-muted-foreground text-xs font-medium">
        Recent runs
      </span>
      {data.map((job) => (
        <div key={job.uuid} className="flex items-center gap-2 text-xs">
          <span
            className={`size-1.5 shrink-0 rounded-full ${RUN_DOT[job.status] ?? "bg-muted-foreground"}`}
          />
          <span className="text-muted-foreground">
            {job.finishedAt
              ? formatDistanceToNow(new Date(job.finishedAt), {
                  addSuffix: true,
                })
              : job.status.toLowerCase()}
          </span>
          {configSummary(job) && (
            <span className="text-muted-foreground truncate">
              · {configSummary(job)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
