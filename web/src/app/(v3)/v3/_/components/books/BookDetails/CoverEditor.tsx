"use client"

import { IconBook, IconHeadphones, IconUpload, IconX } from "@tabler/icons-react"
import { useEffect, useState } from "react"
import { useWatch } from "react-hook-form"

import { Book3D, type SpineInfo } from "@v3/_/components/books/Book3D"
import { Button } from "@v3/_/components/ui/button"
import { cn } from "@v3/_/lib/utils"

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

// a single editable cover: the live image (pending upload or current cover)
// plus its upload / replace / clear controls. plain <img> on purpose so the
// edit view never swaps in the animated Book3D / double-cover widget.
function CoverSlot({
  label,
  icon: Icon,
  file,
  currentUrl,
  width,
  square,
  onFileChange,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  file: File | null
  currentUrl: string
  width: number
  square: boolean
  onFileChange: (file: File | null) => void
}) {
  const previewUrl = useFilePreview(file)

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="bg-muted relative overflow-hidden rounded-lg shadow-sm"
        style={{ width, aspectRatio: square ? "1 / 1" : "2 / 3" }}
      >
        <img
          src={previewUrl ?? currentUrl}
          alt={label}
          className="h-full w-full object-cover"
        />

        {file && (
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="absolute top-1.5 right-1.5"
            aria-label={`Clear new ${label.toLowerCase()}`}
            onClick={() => {
              onFileChange(null)
            }}
          >
            <IconX className="h-3 w-3" />
          </Button>
        )}
      </div>

      <label
        className={cn(
          "text-muted-foreground hover:text-foreground hover:bg-accent inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
          file && "text-primary",
        )}
        style={{ maxWidth: width }}
      >
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const selected = e.target.files?.[0]
            if (selected) onFileChange(selected)
          }}
        />
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="flex items-center gap-1 truncate">
          <IconUpload className="h-3 w-3 shrink-0" />
          {file ? "Replace" : "Upload"} {label.toLowerCase()}
        </span>
      </label>
    </div>
  )
}

export function CoverEditor({ compact }: { compact: boolean }) {
  const { book, form, isEditing } = useBookForm()
  const coverWidth = compact ? 150 : 176

  const canSetEbookCover = !!book.ebook || !!book.readaloud
  const canSetAudioCover = !!book.audiobook || !!book.readaloud

  const textCover = useWatch({ control: form.control, name: "textCover" })
  const audioCover = useWatch({ control: form.control, name: "audioCover" })

  if (!isEditing) {
    return <Book3D book={book} width={coverWidth} spine={SPINE_INFO} />
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
          label="Ebook cover"
          icon={IconBook}
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
          label="Audiobook cover"
          icon={IconHeadphones}
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
