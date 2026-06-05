"use client"

import { IconPencil, IconUpload, IconX } from "@tabler/icons-react"
import { useEffect, useState } from "react"
import { useWatch } from "react-hook-form"

import {
  Book3D,
  BookFullscreenButton,
  type SpineInfo,
} from "@v3/_/components/books/Book3D"
import { Button } from "@v3/_/components/ui/button"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { getCoverUrl } from "@/store/api"

import { useBookForm } from "./BookFormProvider"

// local toggle: flip to "pages" or "duration" to print length info on the
// spine instead of the author / title
const SPINE_INFO: SpineInfo = "title"

function useFilePreview(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  return url
}

// an editable cover: the live image (pending upload or saved cover) with a
// click-anywhere upload overlay laid on top. the whole cover is the file
// <label>, so it stays keyboard- and screenreader-friendly via the sr-only
// input + text. the overlay is half-transparent so the cover stays visible.
function CoverSlot({
  label,
  file,
  currentUrl,
  width,
  square,
  onFileChange,
}: {
  label: string
  file: File | null
  currentUrl: string
  width: number
  square: boolean
  onFileChange: (file: File | null) => void
}) {
  const t = useTranslation("BookDetailsPage")
  const previewUrl = useFilePreview(file)

  return (
    <div
      className="group/slot relative shrink-0"
      style={{ width, aspectRatio: square ? "1 / 1" : "2 / 3" }}
    >
      <img
        src={previewUrl ?? currentUrl}
        alt=""
        aria-hidden
        className="h-full w-full rounded-xs object-cover shadow-sm"
      />

      <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xs bg-black/20 text-white transition-colors group-hover/slot:bg-black/40">
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const selected = e.target.files?.[0]
            if (selected) onFileChange(selected)
          }}
        />
        <span className="sr-only">{label}</span>
        <span
          aria-hidden
          className="flex items-center gap-1.5 rounded-md bg-black/55 px-2.5 py-1.5 text-xs font-medium"
        >
          <IconUpload className="h-4 w-4" />
          {file ? "Replace" : "Upload"}
        </span>
      </label>

      {file && (
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          className="absolute top-1.5 right-1.5 z-10 opacity-90"
          aria-label={t("cover.clear")}
          onClick={() => {
            onFileChange(null)
          }}
        >
          <IconX className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

export function CoverEditor({ compact }: { compact: boolean }) {
  const { book, form, canEdit, isEditing, editingCovers, setEditingCovers } =
    useBookForm()
  const t = useTranslation("BookDetailsPage")
  const coverWidth = compact ? 150 : 176

  const canSetEbookCover = !!book.ebook || !!book.readaloud
  const canSetAudioCover = !!book.audiobook || !!book.readaloud

  const textCover = useWatch({ control: form.control, name: "textCover" })
  const audioCover = useWatch({ control: form.control, name: "audioCover" })

  if (!isEditing && !editingCovers) {
    return (
      <Book3D
        book={book}
        width={coverWidth}
        spine={SPINE_INFO}
        actions={
          <>
            {canEdit && (
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                onClick={() => {
                  setEditingCovers(true)
                }}
                aria-label={t("cover.edit")}
                className="bg-background/85 text-foreground/70 hover:text-foreground rounded-md p-1.5"
              >
                <IconPencil className="size-4" />
              </Button>
            )}

            <BookFullscreenButton
              book={book}
              width={coverWidth}
              spine={SPINE_INFO}
            />
          </>
        }
      />
    )
  }

  const ebookUrl = getCoverUrl(book.uuid, {
    width: 400,
    height: 600,
    audio: false,
    updatedAt: book.ebook?.updatedAt ?? book.updatedAt,
  })
  const audioUrl = getCoverUrl(book.uuid, {
    width: 400,
    height: 400,
    audio: true,
    updatedAt: book.audiobook?.updatedAt ?? book.updatedAt,
  })

  return (
    <div className="flex shrink-0 flex-wrap items-start justify-center gap-4">
      {canSetEbookCover && (
        <CoverSlot
          label={t("cover.uploadEbook")}
          file={textCover}
          currentUrl={ebookUrl}
          width={coverWidth}
          square={false}
          onFileChange={(file) => {
            form.setValue("textCover", file)
          }}
        />
      )}

      {canSetAudioCover && (
        <CoverSlot
          label={t("cover.uploadAudiobook")}
          file={audioCover}
          currentUrl={audioUrl}
          width={coverWidth}
          square
          onFileChange={(file) => {
            form.setValue("audioCover", file)
          }}
        />
      )}
    </div>
  )
}
