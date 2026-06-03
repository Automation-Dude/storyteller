"use client"

import {
  IconBook,
  IconHeadphones,
  IconUpload,
  IconX,
} from "@tabler/icons-react"
import { useEffect, useState } from "react"
import { useWatch } from "react-hook-form"

import { Book3D, type SpineInfo } from "@v3/_/components/books/Book3D"
import { BookCover } from "@v3/_/components/books/BookCover"
import { Button } from "@v3/_/components/ui/button"
import { cn } from "@v3/_/lib/utils"

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

type CoverUploadRowProps = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  file: File | null
  onFileChange: (file: File | null) => void
}

function CoverUploadRow({
  label,
  icon: Icon,
  file,
  onFileChange,
}: CoverUploadRowProps) {
  const previewUrl = useFilePreview(file)

  return (
    <div className="flex items-center gap-3">
      {previewUrl && (
        <img
          src={previewUrl}
          alt={`${label} preview`}
          className="h-12 w-9 rounded object-cover"
        />
      )}

      <div className="flex flex-1 items-center gap-2">
        <Icon className="text-muted-foreground h-4 w-4 shrink-0" />

        <span className="text-muted-foreground text-xs">
          {file ? file.name : label}
        </span>
      </div>

      <label
        className={cn(
          "text-muted-foreground hover:text-foreground hover:bg-accent inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
          file && "text-primary",
        )}
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
        <IconUpload className="h-3.5 w-3.5" />
        {file ? "Replace" : "Upload"}
      </label>

      {file && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
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
  const { book, form, isEditing } = useBookForm()
  const coverWidth = compact ? 176 : 200

  const canSetEbookCover = !!book.ebook || !!book.readaloud
  const canSetAudioCover = !!book.audiobook || !!book.readaloud

  const textCover = useWatch({ control: form.control, name: "textCover" })
  const audioCover = useWatch({ control: form.control, name: "audioCover" })
  const textPreviewUrl = useFilePreview(textCover)

  if (!isEditing) {
    return <Book3D book={book} width={coverWidth} spine={SPINE_INFO} />
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        {textPreviewUrl ? (
          <img
            src={textPreviewUrl}
            alt="New cover preview"
            className="rounded-lg object-contain"
            style={{ maxWidth: coverWidth, maxHeight: compact ? 280 : 300 }}
          />
        ) : (
          <BookCover book={book} width={coverWidth} key={book.uuid} />
        )}
      </div>

      <div className="flex w-52 flex-col gap-1.5">
        {canSetEbookCover && (
          <CoverUploadRow
            label="Ebook cover"
            icon={IconBook}
            file={textCover}
            onFileChange={(file) => {
              form.setValue("textCover", file)
            }}
          />
        )}

        {canSetAudioCover && (
          <CoverUploadRow
            label="Audiobook cover"
            icon={IconHeadphones}
            file={audioCover}
            onFileChange={(file) => {
              form.setValue("audioCover", file)
            }}
          />
        )}
      </div>
    </div>
  )
}
