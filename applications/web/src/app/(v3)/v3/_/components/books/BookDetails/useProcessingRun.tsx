"use client"

import { type ReactNode, useState } from "react"

import { type BookWithRelations } from "@/database/books"
import { usePermission } from "@/hooks/usePermission"
import * as icon from "@/icons"
import { useProcessBookMutation } from "@/store/api"
import { STAGE_ORDER } from "@/work/stages"

import { ProcessRunDialog } from "./ProcessRunDialog"

export type ProcessRestart = false | "sync" | "transcription" | "full"

type PositionLabelKey =
  | "startProcessing"
  | "continue"
  | "resync"
  | "fromSync"
  | "fromTranscription"
  | "fullRestart"

export type ProcessingPosition = {
  key: string
  labelKey: PositionLabelKey
  icon: ReactNode
  restart: ProcessRestart
  disabled: boolean
}

export function buildProcessingPositions(
  book: BookWithRelations,
): ProcessingPosition[] {
  if (!book.readaloud) {
    return [
      {
        key: "start",
        labelKey: "startProcessing",
        icon: <icon.Progress className="mr-2 size-4" />,
        restart: false,
        disabled: false,
      },
    ]
  }

  const aligned = !!book.readaloud.filepath
  const currentStageOrder = STAGE_ORDER[book.readaloud.currentStage]

  return [
    {
      key: "continue",
      labelKey: aligned ? "resync" : "continue",
      icon: <icon.Progress className="mr-2 size-4" />,
      restart: false,
      disabled: false,
    },
    {
      key: "sync",
      labelKey: "fromSync",
      icon: <icon.Progress className="mr-2 size-4" />,
      restart: "sync",
      disabled: currentStageOrder < 2,
    },
    {
      key: "transcription",
      labelKey: "fromTranscription",
      icon: <icon.Reload className="mr-2 size-4" />,
      restart: "transcription",
      disabled: currentStageOrder < 1,
    },
    {
      key: "full",
      labelKey: "fullRestart",
      icon: <icon.Reload className="mr-2 size-4" />,
      restart: "full",
      disabled: false,
    },
  ]
}

export function useProcessingRun(book?: BookWithRelations) {
  const canConfigure = usePermission("settingsUpdate")
  const [processBook] = useProcessBookMutation()
  const [dialogRestart, setDialogRestart] = useState<ProcessRestart | null>(
    null,
  )

  const start = (restart: ProcessRestart) => {
    if (!book) return
    if (canConfigure) {
      setDialogRestart(restart)
    } else {
      void processBook({ uuid: book.uuid, restart })
    }
  }

  const dialog = book ? (
    <ProcessRunDialog
      book={book}
      restart={dialogRestart ?? false}
      open={dialogRestart !== null}
      onOpenChange={(open) => {
        if (!open) setDialogRestart(null)
      }}
    />
  ) : null

  return {
    start,
    dialog,
    positions: book ? buildProcessingPositions(book) : [],
  }
}
