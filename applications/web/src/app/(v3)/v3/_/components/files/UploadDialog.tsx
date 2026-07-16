"use client"

import { type ReactNode, useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"

import { UploadDropzone } from "@v3/_/components/files/UploadDropzone"
import {
  type UppyFileType,
  useTusUpload,
} from "@v3/_/components/files/useTusUpload"
import { Button } from "@v3/_/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v3/_/components/ui/dialog"
import { Label } from "@v3/_/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v3/_/components/ui/select"

import { type MetadataFieldMode } from "@/database/settingsTypes"

type Restrictions = {
  maxNumberOfFiles?: number | null
  allowedFileTypes?: string[] | null
}

export type UploadDialogLabels = {
  metadataBehavior: ReactNode
  metadataMerge: string
  metadataSkip: string
  metadataOverwrite: string
  failedFiles: (count: number) => ReactNode
  cancel: ReactNode
  upload: ReactNode
  done: ReactNode
  uploadAnother: ReactNode
}

export type UploadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  endpoint: string
  restrictions?: Restrictions
  accept?: string
  multiple?: boolean
  hint?: string
  buildMeta?: (file: UppyFileType) => void
  onFinalize?: () => Promise<void>
  onComplete?: () => void
  showMetadataMode?: boolean
  metadataMode?: MetadataFieldMode
  onMetadataModeChange?: (mode: MetadataFieldMode) => void
  labels: UploadDialogLabels
  children?: ReactNode
}

export function UploadDialog({
  open,
  onOpenChange,
  title,
  description,
  endpoint,
  restrictions,
  accept,
  multiple,
  hint,
  buildMeta,
  onFinalize,
  onComplete,
  showMetadataMode = true,
  metadataMode: controlledMetadataMode,
  onMetadataModeChange,
  labels,
  children,
}: UploadDialogProps) {
  const [internalMetadataMode, setInternalMetadataMode] =
    useState<MetadataFieldMode>("merge")
  const [isFinalizing, setIsFinalizing] = useState(false)

  const metadataMode = controlledMetadataMode ?? internalMetadataMode
  const setMetadataMode = onMetadataModeChange ?? setInternalMetadataMode

  const metadataModeOptions = [
    { value: "merge" as const, label: labels.metadataMerge },
    { value: "skip" as const, label: labels.metadataSkip },
    { value: "always" as const, label: labels.metadataOverwrite },
  ]

  const batchIdRef = useRef(uuidv4())

  const { uppy, files, isComplete, failedCount, reset, startUpload } =
    useTusUpload({
      endpoint,
      restrictions,
      buildMeta: (file) => {
        file.meta["batchId"] = batchIdRef.current
        buildMeta?.(file)
      },
    })

  function handleClose() {
    reset()
    onComplete?.()
    onOpenChange(false)
  }

  function handleUploadAnother() {
    reset()
    batchIdRef.current = uuidv4()
  }

  function handleUpload() {
    batchIdRef.current = uuidv4()
    startUpload()
  }

  async function handleFinalize() {
    if (!onFinalize) return

    setIsFinalizing(true)
    try {
      await onFinalize()
    } catch (e) {
      console.error(e)
    } finally {
      setIsFinalizing(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <UploadDropzone
          uppy={uppy}
          accept={accept}
          multiple={multiple}
          hint={hint}
        />

        {children}

        {showMetadataMode && (
          <div className="flex flex-col gap-1">
            <Label>{labels.metadataBehavior}</Label>
            <Select
              value={metadataMode}
              onValueChange={(v) => {
                setMetadataMode(v as MetadataFieldMode)
              }}
              items={metadataModeOptions.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {metadataModeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isComplete && failedCount > 0 && onFinalize && (
          <Button
            variant="outline"
            disabled={isFinalizing}
            onClick={() => void handleFinalize()}
          >
            {labels.failedFiles(failedCount)}
          </Button>
        )}

        <DialogFooter>
          {isComplete ? (
            <>
              <Button variant="ghost" onClick={handleUploadAnother}>
                {labels.uploadAnother}
              </Button>
              <Button onClick={handleClose}>{labels.done}</Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  reset()
                  onOpenChange(false)
                }}
              >
                {labels.cancel}
              </Button>
              <Button disabled={!files.length} onClick={handleUpload}>
                {labels.upload}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
