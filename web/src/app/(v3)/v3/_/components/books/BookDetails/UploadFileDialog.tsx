"use client"

import { useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"

import { UploadDropzone } from "@v3/_/components/files/UploadDropzone"
import { useTusUpload } from "@v3/_/components/files/useTusUpload"
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

import { type BookWithRelations } from "@/database/books"
import {
  type MetadataFieldMode,
  defaultMetadataFieldOverrides,
} from "@/database/settingsTypes"

type Format = "ebook" | "audiobook" | "readaloud"

const nav = typeof navigator != "undefined" ? navigator : null
const agent = (nav && nav.userAgent) || ""
const ie = /Edge\/(\d+)/.test(agent) || /MSIE \d/.test(agent)
// eslint-disable-next-line @typescript-eslint/no-deprecated
const safari = !ie && !!nav && /Apple Computer/.test(nav.vendor)
const ios = safari && (/Mobile\/\w+/.test(agent) || nav.maxTouchPoints > 2)

const epubFileTypes = ["application/epub+zip", ...(ios ? [] : [".epub"])]
const audioFileTypes = ios
  ? null
  : ["video/mp4", "audio/*", "application/zip", ".m4b", ".m4a", ".zip"]

const METADATA_MODE_OPTIONS: { value: MetadataFieldMode; label: string }[] = [
  { value: "merge", label: "Merge with existing" },
  { value: "skip", label: "Keep existing" },
  { value: "always", label: "Overwrite from new file" },
]

function tusEndpointForBook(bookUuid: string) {
  const path = `/api/v2/books/${bookUuid}/replace-asset/upload`
  if (typeof window === "undefined") return path
  return new URL(path, window.location.origin).toString()
}

export function UploadFileDialog({
  book,
  format,
  open,
  onOpenChange,
}: {
  book: BookWithRelations
  format: Format
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isAdd = !book[format]?.filepath
  const [metadataMode, setMetadataMode] = useState<MetadataFieldMode>("merge")
  const [isFinalizing, setIsFinalizing] = useState(false)

  // each upload run gets a fresh batch id so the server can group tracks
  const batchIdRef = useRef(uuidv4())

  const { uppy, files, isComplete, failedCount, reset, startUpload } =
    useTusUpload({
      endpoint: tusEndpointForBook(book.uuid),
      restrictions: {
        maxNumberOfFiles: format === "audiobook" ? null : 1,
        allowedFileTypes:
          format === "audiobook" ? audioFileTypes : epubFileTypes,
      },
      buildMeta: (file) => {
        const overrides = defaultMetadataFieldOverrides(metadataMode)
        file.meta["bookUuid"] = book.uuid
        file.meta["format"] = format
        file.meta["metadataFieldOverrides"] = JSON.stringify(overrides)
        file.meta["batchId"] = batchIdRef.current
        if (format === "audiobook") {
          file.meta["totalAudioFiles"] = String(uppy.getFiles().length)
        }
      },
    })

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  function handleUpload() {
    if (isComplete) {
      reset()
      batchIdRef.current = uuidv4()
      return
    }
    batchIdRef.current = uuidv4()
    startUpload()
  }

  async function finalize() {
    setIsFinalizing(true)
    try {
      await fetch(`/api/v2/books/${book.uuid}/replace-asset/upload/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadataFieldOverrides: defaultMetadataFieldOverrides(metadataMode),
        }),
      })
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
          <DialogTitle>
            {isAdd ? `Upload ${format}` : `Upload replacement ${format}`}
          </DialogTitle>
          <DialogDescription>
            {format === "audiobook"
              ? `Upload audio files from your device.${!isAdd ? " Existing tracks will be replaced." : ""}`
              : `Upload a .epub file to ${isAdd ? "add" : "replace"} the ${format}.`}
          </DialogDescription>
        </DialogHeader>

        <UploadDropzone
          uppy={uppy}
          accept={
            format === "audiobook"
              ? "audio/*,video/mp4,.m4b,.m4a,.zip"
              : ".epub"
          }
          multiple={format === "audiobook"}
          hint={
            format === "audiobook"
              ? "Audio files (mp3, m4a, m4b…)"
              : ".epub file"
          }
        />

        <div className="flex flex-col gap-1">
          <Label>Metadata behavior</Label>
          <Select
            value={metadataMode}
            onValueChange={(v) => {
              setMetadataMode(v as MetadataFieldMode)
            }}
            items={METADATA_MODE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METADATA_MODE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isComplete && format === "audiobook" && failedCount > 0 && (
          <Button
            variant="outline"
            disabled={isFinalizing}
            onClick={() => void finalize()}
          >
            {failedCount} audio file{failedCount === 1 ? "" : "s"} failed to
            upload — process the rest anyway
          </Button>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={!files.length} onClick={handleUpload}>
            {isComplete ? "Done! Upload another?" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
