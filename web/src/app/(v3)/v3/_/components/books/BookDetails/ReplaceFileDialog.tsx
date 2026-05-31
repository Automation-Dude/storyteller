"use client"

import { IconAlertTriangle } from "@tabler/icons-react"
import { useState } from "react"

import { ServerFileBrowser } from "@v3/_/components/files/ServerFileBrowser"
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
  type ImportMode,
  type MetadataFieldMode,
  defaultMetadataFieldOverrides,
} from "@/database/settingsTypes"
import { useReplaceBookAssetMutation } from "@/store/api"

type Format = "ebook" | "audiobook" | "readaloud"

const AUDIO_FILE_EXTENSIONS = [
  ".mp3",
  ".aac",
  ".mp4",
  ".m4a",
  ".m4b",
  ".opus",
  ".ogg",
  ".oga",
  ".mogg",
  ".wav",
  ".aiff",
  ".flac",
  ".alac",
  ".weba",
]

function isEbookFilter(entry: { name: string; isDirectory: boolean }) {
  return !entry.isDirectory && entry.name.toLowerCase().endsWith(".epub")
}

function isAudioFileFilter(entry: { name: string; isDirectory: boolean }) {
  return (
    !entry.isDirectory &&
    AUDIO_FILE_EXTENSIONS.some((ext) => entry.name.toLowerCase().endsWith(ext))
  )
}

function siblingDir(book: BookWithRelations, format: Format): string {
  const others: Format[] = (
    ["ebook", "audiobook", "readaloud"] as const
  ).filter((f) => f !== format)

  for (const f of others) {
    const filepath = book[f]?.filepath
    if (!filepath) continue
    const i = filepath.lastIndexOf("/")
    return i === -1 ? "" : filepath.slice(0, i + 1)
  }

  return ""
}

const IMPORT_MODE_OPTIONS: { value: ImportMode; label: string }[] = [
  { value: "reference", label: "Reference in place" },
  { value: "copy", label: "Copy to library" },
  { value: "move", label: "Move to library" },
  { value: "hardlink", label: "Hard link to library" },
]

const METADATA_MODE_OPTIONS: { value: MetadataFieldMode; label: string }[] = [
  { value: "merge", label: "Merge with existing" },
  { value: "skip", label: "Keep existing" },
  { value: "always", label: "Overwrite from new file" },
]

export function ReplaceFileDialog({
  book,
  format,
  assetsDir,
  open,
  onOpenChange,
}: {
  book: BookWithRelations
  format: Format
  assetsDir?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [replaceAsset, { isLoading }] = useReplaceBookAssetMutation()

  const currentPath = book[format]?.filepath ?? siblingDir(book, format)
  const isAdd = !book[format]?.filepath

  const [path, setPath] = useState(currentPath)
  const [importMode, setImportMode] = useState<ImportMode>("reference")
  const [metadataMode, setMetadataMode] = useState<MetadataFieldMode>("merge")
  const [error, setError] = useState<string | null>(null)

  // anchored against the real assets root, not a loose substring match
  const assetRoot =
    assetsDir && book.assetDir ? `${assetsDir}/${book.assetDir}` : null
  const sourceInsideAssetDir = Boolean(
    path &&
      assetRoot &&
      (path === assetRoot || path.startsWith(`${assetRoot}/`)),
  )

  async function handleSubmit() {
    setError(null)
    if (!path) {
      setError("Pick a file or directory")
      return
    }

    try {
      let finalPath = path
      if (format === "audiobook") {
        // audiobooks import as a directory; collapse a selected file to its parent
        finalPath = path.replace(/(\/|\\)[^/\\]*?$/, "$1")
      }

      await replaceAsset({
        uuid: book.uuid,
        format,
        path: finalPath,
        importMode,
        metadataFieldOverrides: defaultMetadataFieldOverrides(metadataMode),
      }).unwrap()

      onOpenChange(false)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to replace file. Check server logs.",
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-10 flex max-h-[85vh] translate-y-0 flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isAdd
              ? `Import ${format} from server`
              : `Replace ${format} from server`}
          </DialogTitle>
          <DialogDescription>
            {format === "audiobook"
              ? "Pick a directory of audio files, or a file to use its parent directory."
              : "Pick a .epub file on the server."}
          </DialogDescription>
        </DialogHeader>

        <ServerFileBrowser
          startPath={currentPath}
          fileFilter={
            format === "audiobook" ? isAudioFileFilter : isEbookFilter
          }
          onSelect={setPath}
          selectLabel={
            format === "audiobook" ? "Use this directory" : undefined
          }
          className="min-h-0 flex-1"
        />

        {path && (
          <p className="text-muted-foreground text-xs break-all">
            Selected: <code className="font-mono">{path}</code>
          </p>
        )}

        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <Label>Import mode</Label>
            <Select
              value={importMode}
              onValueChange={(v) => {
                setImportMode(v as ImportMode)
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMPORT_MODE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Metadata behavior</Label>
            <Select
              value={metadataMode}
              onValueChange={(v) => {
                setMetadataMode(v as MetadataFieldMode)
              }}
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
        </div>

        {!isAdd && (
          <p className="text-muted-foreground text-xs">
            Replace will delete the current {format} files in this book&apos;s
            asset folder before importing the new source.
          </p>
        )}

        {sourceInsideAssetDir && (
          <div className="text-destructive flex items-start gap-2 text-xs">
            <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              The selected path is inside this book&apos;s asset folder. The
              replace would delete the source before reading it. Pick a path
              outside the library.
            </span>
          </div>
        )}

        {error && <p className="text-destructive text-xs">{error}</p>}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false)
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={isLoading || sourceInsideAssetDir}
          >
            {isAdd ? "Import" : "Replace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
