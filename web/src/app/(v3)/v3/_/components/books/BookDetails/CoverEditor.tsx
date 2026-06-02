"use client"

import {
  IconBook,
  IconHeadphones,
  IconUpload,
  IconX,
} from "@tabler/icons-react"
import { useEffect, useState } from "react"

import { BookCover } from "@v3/_/components/books/BookCover"
import { Button } from "@v3/_/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@v3/_/components/ui/dialog"
import { cn } from "@v3/_/lib/utils"

import { useBookForm } from "./BookFormProvider"
import { useWatch } from "react-hook-form"
import { useCoverColors } from "./sections/useCoverColors"

function useFilePreview(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
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
          onClick={() => onFileChange(null)}
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

  const coverColors = useCoverColors(book, { opacity: 1 })

  const canSetEbookCover = !!book.ebook || !!book.readaloud
  const canSetAudioCover = !!book.audiobook || !!book.readaloud

  const textCover = useWatch({ control: form.control, name: "textCover" })
  const audioCover = useWatch({ control: form.control, name: "audioCover" })
  const textPreviewUrl = useFilePreview(textCover)
  console.log(coverColors)

  if (!isEditing) {
    return (
      // <Dialog>
      //   <DialogTrigger
      //     className={cn(
      //       "hover-3d flex shrink-0 cursor-zoom-in flex-col items-center justify-center rounded-lg",
      //       compact
      //         ? "mx-auto h-80 w-60"
      //         : "flex w-[clamp(140px,25vw,200px)] justify-center md:justify-start",
      //     )}
      //   >
      <div className="c z-1 perspective-distant">
        <div className="book relative w-60 shrink-0 transition-transform duration-500 transform-3d hover:transform-[rotate3d(0,1,0,35deg)]">
          <div className="transform-[translate3d(0,0,20px)] overflow-clip transition-[border-radius] duration-500 hover:rounded-r-xs [&_img]:rounded-none!">
            <BookCover book={book} width={coverWidth} key={book.uuid} />
          </div>
          <div
            className="absolute top-0 -left-5 h-full w-10 transform-[rotate3d(0,1,0,-90deg)]"
            style={{
              background: coverColors.primary.accent,
              // background: `linear-gradient(to bottom, ${coverColors.primary.accent} 0%, ${coverColors.primary.accent} 50%, ${coverColors.others[0]?.accent} 100%)`,
            }}
          >
            <h2
              className="relative flex max-w-60 origin-top-left transform-[rotate(90deg)_translateY(-30px)_translateX(30%)] items-center justify-between gap-4 font-serif text-sm whitespace-nowrap"
              style={{ color: coverColors.primary.contrast }}
            >
              <span className="font-sans">
                {book.authors.map((author) => author.name).join(", ")}
              </span>
              <span>{book.title}</span>
            </h2>
          </div>
          {/* <div />
          <div />
          <div />
          <div />
          <div />
          <div />
          <div />
          <div /> */}
        </div>
        <div className="mt-4 flex gap-2">
          <div
            className="p-1"
            style={{ background: coverColors.primary.accent }}
          >
            <span
              style={{
                color: coverColors.primary._contrast >= 128 ? "white" : "black",
              }}
            >
              {String(coverColors.primary._contrast).padStart(3, "0")}
            </span>
          </div>
          {coverColors.others.map((color) => (
            <div
              key={color.accent}
              className="p-1"
              style={{ background: color.accent }}
            >
              <span style={{ color: color.contrast }}>
                {String(color._contrastWithPrimary.toFixed(2)).padStart(3, "0")}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
    // </DialogTrigger>

    //   <DialogContent className="p-0!">
    //     <BookCover book={book} width={400} key={book.uuid} />
    //   </DialogContent>
    // </Dialog>
    // )
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
            onFileChange={(file) => form.setValue("textCover", file)}
          />
        )}

        {canSetAudioCover && (
          <CoverUploadRow
            label="Audiobook cover"
            icon={IconHeadphones}
            file={audioCover}
            onFileChange={(file) => form.setValue("audioCover", file)}
          />
        )}
      </div>
    </div>
  )
}
