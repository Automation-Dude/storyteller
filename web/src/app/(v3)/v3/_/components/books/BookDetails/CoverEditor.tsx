"use client"

import { IconCamera, IconX } from "@tabler/icons-react"
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

export function CoverEditor({ compact }: { compact: boolean }) {
  const { book, form, isEditing } = useBookForm()
  const textCover = form.watch("textCover")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!textCover) {
      setPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(textCover)
    setPreviewUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [textCover])

  const coverWidth = compact ? 176 : 200

  if (!isEditing) {
    return (
      <Dialog>
        <DialogTrigger
          className={cn(
            "flex shrink-0 cursor-zoom-in flex-col items-center justify-center rounded-lg",
            compact
              ? "mx-auto h-80 w-60"
              : "flex w-[clamp(140px,25vw,200px)] justify-center md:justify-start",
          )}
        >
          <BookCover book={book} width={coverWidth} key={book.uuid} />
        </DialogTrigger>

        <DialogContent className="p-0!">
          <BookCover book={book} width={400} key={book.uuid} />
        </DialogContent>
      </Dialog>
    )
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    form.setValue("textCover", file)
    form.setValue("audioCover", null)
  }

  const handleClear = () => {
    form.setValue("textCover", null)
    form.setValue("audioCover", null)
  }

  return (
    <div className="group/cover relative inline-flex">
      {previewUrl ? (
        <img
          src={previewUrl}
          alt="New cover preview"
          className="rounded-lg object-contain"
          style={{ maxWidth: coverWidth, maxHeight: compact ? 280 : 300 }}
        />
      ) : (
        <BookCover book={book} width={coverWidth} key={book.uuid} />
      )}

      <label
        className={cn(
          "absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg transition-opacity",
          "bg-black/50",
          previewUrl
            ? "opacity-0 group-hover/cover:opacity-100"
            : "opacity-0 group-hover/cover:opacity-100",
        )}
      >
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <IconCamera className="h-6 w-6 text-white" />
        <span className="text-xs font-medium text-white">Change cover</span>
      </label>

      {previewUrl && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="bg-background/80 hover:bg-background absolute top-2 right-2 rounded-full shadow-sm"
          onClick={handleClear}
        >
          <IconX className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
