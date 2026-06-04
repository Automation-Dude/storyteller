"use client"

import {
  IconAlertTriangle,
  IconCheck,
  IconProgress,
  IconX,
} from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "@v3/_/components/ui/button"

import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { type BookWithRelations } from "@/database/books"
import { usePermission } from "@/hooks/usePermission"
import {
  useCancelProcessingMutation,
  useProcessBookMutation,
} from "@/store/api"

import { ProcessingModal } from "./ProcessingModal"

const PROCESSING_STAGE_LABELS: Record<string, string> = {
  SPLIT_TRACKS: "Pre-processing audio",
  TRANSCRIBE_CHAPTERS: "Transcribing tracks",
  SYNC_CHAPTERS: "Synchronizing chapters",
}

export function TranscriptionStatus({ book }: { book: BookWithRelations }) {
  const [processBook] = useProcessBookMutation()
  const [cancelProcessing] = useCancelProcessingMutation()
  const canProcess = usePermission("bookProcess")

  const [processingModalOpen, setProcessingModalOpen] = useState(false)

  const hasEbook = book.ebook !== null
  const hasAudiobook = book.audiobook !== null
  const canCreateReadaloud = hasEbook && hasAudiobook && !book.readaloud

  const readaloudStatus = book.readaloud?.status
  const aligned = !!book.readaloud?.filepath
  const isBusy =
    readaloudStatus === "QUEUED" || readaloudStatus === "PROCESSING"

  const t = useTranslations("BookDetailsPage.alignment")

  if (!readaloudStatus && !canCreateReadaloud && !canProcess) {
    return null
  }

  return (
    <section className="mb-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-label flex-1">
          <IconProgress className="h-4 w-4" />
          {t("title")}
        </h2>
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => void processBook({ uuid: book.uuid })}
            >
              {t("retry")}
            </Button>
          </div>
        )}

        {!readaloudStatus && canCreateReadaloud && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void processBook({ uuid: book.uuid })}
          >
            <IconReadaloud className="mr-1 h-4 w-4" />
            {t("createReadaloud")}
          </Button>
        )}

        {!readaloudStatus && !canCreateReadaloud && (
          <span className="text-muted-foreground text-sm">
            {t("unprocessed")}
          </span>
        )}
      </div>

      {canProcess && (
        <ProcessingModal
          book={book}
          aligned={aligned}
          open={processingModalOpen}
          onOpenChange={setProcessingModalOpen}
        />
      )}
    </section>
  )
}
