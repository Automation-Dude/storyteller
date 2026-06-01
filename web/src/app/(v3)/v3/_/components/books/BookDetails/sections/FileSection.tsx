"use client"
import {
  IconAlertTriangle,
  IconBook,
  IconFileText,
  IconHeadphones,
  IconPlus,
  IconRefresh,
  IconServer,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { type ComponentType, useState } from "react"

import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v3/_/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { useFormatDate } from "@v3/_/lib/date"

import { FilePathRow } from "@/app/(v3)/v3/_/components/books/BookDetails/FilePathRow"
import { ReplaceFileDialog } from "@/app/(v3)/v3/_/components/books/BookDetails/ReplaceFileDialog"
import { UploadFileDialog } from "@/app/(v3)/v3/_/components/books/BookDetails/UploadFileDialog"
import { cn } from "@/cn"
import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { formatTimeHuman } from "@/components/reader/preferenceItems/formatTime"
import { type BookWithRelations } from "@/database/books"
import { usePermission } from "@/hooks/usePermission"
import { useRemoveBookAssetMutation } from "@/store/api"
import { formatFileSize } from "@/utils/formatFileSize"

type Format = "ebook" | "audiobook" | "readaloud"

const FORMAT_LABELS: Record<Format, string> = {
  ebook: "Ebook",
  audiobook: "Audiobook",
  readaloud: "Readaloud",
}

const FORMAT_ICONS: Record<Format, ComponentType<{ className?: string }>> = {
  ebook: IconBook,
  audiobook: IconHeadphones,
  readaloud: IconReadaloud,
}

function FormatFileRow({
  book,
  format,
  canRemove,
  onReplaceServer,
  onReplaceUpload,
  onRemove,
}: {
  book: BookWithRelations
  format: Format
  canRemove: boolean
  onReplaceServer: () => void
  onReplaceUpload: () => void
  onRemove: () => void
}) {
  const fmt = book[format]

  const canEdit = usePermission("bookUpdate")

  if (!fmt) return null

  const Icon = FORMAT_ICONS[format]
  const isEpub2 = "isEpub2" in fmt && fmt.isEpub2

  const filepath = fmt.filepath ?? ""
  const lastSlash = filepath.lastIndexOf("/")
  const directory = lastSlash >= 0 ? filepath.slice(0, lastSlash + 1) : ""
  const filename = lastSlash >= 0 ? filepath.slice(lastSlash + 1) : filepath

  const pageCount =
    format !== "audiobook"
      ? book.pageCount ?? ("pageCount" in fmt ? fmt.pageCount : null)
      : null
  const duration =
    format !== "ebook"
      ? book.duration ?? ("duration" in fmt ? fmt.duration : null)
      : null
  const fileSize = formatFileSize(fmt.fileSize ?? null)

  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <span className="text-muted-foreground font-sans text-xs font-semibold uppercase">
            {FORMAT_LABELS[format]}
          </span>
          {!!fmt.missing && (
            <Badge
              variant="destructive"
              className="h-4 gap-0.5 px-1 text-[10px]"
            >
              <IconAlertTriangle className="h-2.5 w-2.5" />
              Missing
            </Badge>
          )}
          {isEpub2 && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              EPUB 2
            </Badge>
          )}
        </div>

        <div className="text-sm" title={filepath}>
          <span className="text-muted-foreground">{directory}</span>
          <code className="font-mono font-medium">{filename}</code>
        </div>

        <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 text-xs">
          {pageCount != null && <span>{pageCount} pages</span>}
          {duration != null && <span>{formatTimeHuman(duration)}</span>}
          {fileSize && <span>{fileSize}</span>}
        </div>
      </div>

      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Replace ${format} file`}
                >
                  <IconRefresh className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={onReplaceServer}
                className="whitespace-nowrap"
              >
                <IconServer className="mr-2 h-4 w-4" />
                Import from server
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onReplaceUpload}
                className="whitespace-nowrap"
              >
                <IconUpload className="mr-2 h-4 w-4" />
                Upload
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canRemove && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              aria-label={`Remove ${format} from book`}
              onClick={onRemove}
            >
              <IconTrash className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function FileSection({
  book,
  assetsDir,
  className,
}: {
  book: BookWithRelations
  assetsDir?: string
  className?: string
}) {
  const canEdit = usePermission("bookUpdate")
  const t = useTranslations("BookDetailsPage")
  const formatDate = useFormatDate()
  const [removeAsset, { isLoading: isRemoving }] = useRemoveBookAssetMutation()

  const [fileDialog, setFileDialog] = useState<{
    format: Format
    mode: "server" | "upload"
  } | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Format | null>(null)

  const allFormats = ["readaloud", "ebook", "audiobook"] as const
  const presentFormats = allFormats.filter((f) => book[f])
  const missingFormats = (["ebook", "audiobook", "readaloud"] as const).filter(
    (f) => !book[f],
  )
  const canRemove = presentFormats.length > 1

  async function handleConfirmRemove() {
    if (!removeTarget) return
    await removeAsset({ uuid: book.uuid, format: removeTarget }).unwrap()
    setRemoveTarget(null)
  }

  const assetFolder =
    assetsDir && book.assetDir ? `${assetsDir}/${book.assetDir}` : book.assetDir

  return (
    <section className={cn(className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="section-label flex-1">
          <IconFileText className="h-4 w-4" />
          {t("fileInformation.title")}
        </h2>

        {canEdit && missingFormats.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" aria-label="Add file">
                  <IconPlus className="mr-1 h-3.5 w-3.5" />
                  Add file
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-fit">
              {missingFormats.map((f, i) => {
                const FormatIcon = FORMAT_ICONS[f]
                return (
                  <DropdownMenuGroup key={f}>
                    {i > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="flex items-center gap-1.5">
                      <FormatIcon className="h-3 w-3" />
                      {FORMAT_LABELS[f]}
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => {
                        setFileDialog({ format: f, mode: "server" })
                      }}
                    >
                      <IconServer className="mr-2 h-4 w-4" />
                      Import from server
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setFileDialog({ format: f, mode: "upload" })
                      }}
                    >
                      <IconUpload className="mr-2 h-4 w-4" />
                      Upload
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="space-y-3">
        {presentFormats.map((format) => (
          <FormatFileRow
            key={format}
            book={book}
            format={format}
            canRemove={canRemove}
            onReplaceServer={() => {
              setFileDialog({ format, mode: "server" })
            }}
            onReplaceUpload={() => {
              setFileDialog({ format, mode: "upload" })
            }}
            onRemove={() => {
              setRemoveTarget(format)
            }}
          />
        ))}

        {book.alignedAt && (
          <FilePathRow
            label={t("fileInformation.lastAligned")}
            filepath={formatDate(book.alignedAt)}
          />
        )}

        {book.alignedWith && (
          <FilePathRow
            label={t("fileInformation.transcriptionEngine")}
            filepath={book.alignedWith}
          />
        )}

        {book.alignedByStorytellerVersion && (
          <FilePathRow
            label={t("fileInformation.storytellerVersion")}
            filepath={book.alignedByStorytellerVersion}
          />
        )}

        {canEdit && assetFolder && (
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground font-sans text-xs font-semibold uppercase">
              Asset folder
            </span>
            <code className="font-mono text-sm break-all">{assetFolder}</code>
          </div>
        )}
      </div>

      {fileDialog?.mode === "server" && (
        <ReplaceFileDialog
          book={book}
          format={fileDialog.format}
          assetsDir={assetsDir}
          open
          onOpenChange={(next) => {
            if (!next) setFileDialog(null)
          }}
        />
      )}

      {fileDialog?.mode === "upload" && (
        <UploadFileDialog
          book={book}
          format={fileDialog.format}
          open
          onOpenChange={(next) => {
            if (!next) setFileDialog(null)
          }}
        />
      )}

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(next) => {
          if (!next) setRemoveTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Remove {removeTarget ? FORMAT_LABELS[removeTarget] : ""} from book
            </DialogTitle>
            <DialogDescription>
              {removeTarget === "readaloud"
                ? "The readaloud file will be deleted from disk."
                : "Library-owned files will be deleted. Files in your watch folders are left on disk."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setRemoveTarget(null)
              }}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmRemove()}
              disabled={isRemoving}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
