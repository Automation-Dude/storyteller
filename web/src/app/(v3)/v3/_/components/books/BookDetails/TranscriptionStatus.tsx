import {
  IconAlertTriangle,
  IconCheck,
  IconProgress,
  IconX,
} from "@tabler/icons-react"

import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { type BookWithRelations } from "@/database/books"

import { Button } from "@v3/_/components/ui/button"

const PROCESSING_STAGE_LABELS: Record<string, string> = {
  SPLIT_TRACKS: "Pre-processing audio",
  TRANSCRIBE_CHAPTERS: "Transcribing tracks",
  SYNC_CHAPTERS: "Synchronizing chapters",
}

export function TranscriptionStatus({
  book,
  onProcess,
  onCancel,
}: {
  book: BookWithRelations
  onProcess: () => void
  onCancel: () => void
}) {
  const hasEbook = book.ebook !== null
  const hasAudiobook = book.audiobook !== null
  const canCreateReadaloud = hasEbook && hasAudiobook && !book.readaloud

  const readaloudStatus = book.readaloud?.status

  if (!readaloudStatus && !canCreateReadaloud) {
    return null
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <IconProgress className="h-4 w-4" />
        Transcription
      </h2>

      <div className="bg-muted/50 rounded-lg p-4">
        {readaloudStatus === "ALIGNED" && (
          <div className="flex items-center gap-2 text-sm">
            <IconCheck className="h-4 w-4 text-green-600" />
            <span>Aligned</span>
          </div>
        )}

        {readaloudStatus === "QUEUED" && (
          <div className="flex items-center justify-between">
            <span className="text-sm">Queued for alignment</span>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <IconX className="mr-1 h-3 w-3" />
              Cancel
            </Button>
          </div>
        )}

        {readaloudStatus === "PROCESSING" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {PROCESSING_STAGE_LABELS[book.readaloud?.currentStage ?? ""] ??
                  "Processing"}
              </span>
              <Button variant="ghost" size="sm" onClick={onCancel}>
                <IconX className="mr-1 h-3 w-3" />
                Cancel
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
                {readaloudStatus === "ERROR"
                  ? "Processing failed"
                  : "Processing stopped"}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={onProcess}>
              Retry
            </Button>
          </div>
        )}

        {canCreateReadaloud && (
          <Button variant="outline" size="sm" onClick={onProcess}>
            <IconReadaloud className="mr-1 h-4 w-4" />
            Create readaloud
          </Button>
        )}
      </div>
    </section>
  )
}
