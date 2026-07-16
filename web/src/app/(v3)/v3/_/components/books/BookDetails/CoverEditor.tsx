"use client"

import { useEffect, useState } from "react"
import { useWatch } from "react-hook-form"
import { toast } from "sonner"

import {
  Book3D,
  BookFullscreenButton,
  type SpineInfo,
} from "@v3/_/components/books/Book3D"
import { BookCover } from "@v3/_/components/books/BookCover"
import { Button } from "@v3/_/components/ui/button"
import { useUserPreferences } from "@v3/_/components/user-preferences-provider"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"

import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import * as icon from "@/icons"
import { getCoverUrl, useSetUserSettingMutation } from "@/store/api"

import { useBookForm } from "./BookFormProvider"
import { CoverColorsEditor } from "./CoverColorsEditor"

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
  const c = useCommon()
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

      <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xs text-white transition-colors">
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
          <icon.Upload className="h-4 w-4" />
          {file ? "Replace" : "Upload"}
        </span>
      </label>

      <div className="absolute top-1.5 right-1.5 z-10 opacity-90">
        <TooltipButton
          type="button"
          variant="secondary"
          size="icon-sm"
          tooltip={c.plain("actions.download")}
          aria-label={c.plain("actions.download")}
          render={
            <a
              href={currentUrl}
              download={file?.name}
              target="_self"
              rel="noopener noreferrer"
            >
              <icon.Download className="h-3 w-3" />
            </a>
          }
        />
      </div>

      {file && (
        <TooltipButton
          type="button"
          variant="secondary"
          size="icon-sm"
          className="absolute top-1.5 right-1.5 z-10 opacity-90"
          tooltip={c("actions.remove")}
          aria-label={c("actions.remove")}
          onClick={() => {
            onFileChange(null)
          }}
        >
          <icon.Close className="h-3 w-3" />
        </TooltipButton>
      )}
    </div>
  )
}

export function CoverEditor({ compact }: { compact: boolean }) {
  const { book, form, canEdit, isEditing, editingCovers, setEditingCovers } =
    useBookForm()
  const t = useTranslation("BookDetailsPage")
  const coverWidth = compact ? 150 : 176

  const { bookDetailDisplay, gridCoverDisplay, bookDetail3dView } =
    useUserPreferences()
  const [setUserSetting] = useSetUserSettingMutation()
  // the position the book is currently rotated to, so it can be saved as the
  // default; seeded from the saved preference
  const [currentView, setCurrentView] = useState(bookDetail3dView ?? 0)

  const canSetEbookCover = !!book.ebook || !!book.readaloud
  const canSetAudioCover = !!book.audiobook || !!book.readaloud

  const textCover = useWatch({ control: form.control, name: "textCover" })
  const audioCover = useWatch({ control: form.control, name: "audioCover" })

  const handleSaveDefaultView = async () => {
    try {
      await setUserSetting({
        name: "bookDetail3dView",
        value: currentView,
      }).unwrap()
      toast.success(t("cover.savedDefaultPosition"))
    } catch {
      toast.error(t("saveFailed"))
    }
  }

  if (!isEditing && !editingCovers) {
    const editAction = canEdit && (
      <TooltipButton
        variant="secondary"
        size="icon-sm"
        onClick={() => {
          setEditingCovers(true)
        }}
        aria-label={t("cover.edit")}
        tooltip={t("cover.edit")}
        className="bg-background/85 text-foreground/70 hover:text-foreground rounded-full p-1.5"
      >
        <icon.Pencil className="size-4" />
      </TooltipButton>
    )

    // a flat cover that falls back to the user's grid cover-display choice
    if (bookDetailDisplay === "cover") {
      return (
        <div className="group relative flex min-h-50 w-fit shrink-0 items-center justify-center select-none">
          <div style={{ width: coverWidth }}>
            <BookCover
              book={book}
              width={coverWidth}
              displayMode={gridCoverDisplay}
            />
          </div>
          {editAction && (
            <div className="absolute top-1 -right-4 z-30 flex flex-col items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
              {editAction}
            </div>
          )}
        </div>
      )
    }

    return (
      <Book3D
        book={book}
        width={coverWidth}
        spine={SPINE_INFO}
        initialView={bookDetail3dView ?? 0}
        onViewChange={setCurrentView}
        actions={
          <>
            {editAction}

            {currentView !== (bookDetail3dView ?? 0) && (
              <TooltipButton
                variant="secondary"
                size="icon-sm"
                onClick={() => {
                  void handleSaveDefaultView()
                }}
                aria-label={t("cover.setDefaultPosition")}
                tooltip={t("cover.setDefaultPosition")}
                className="bg-background/85 text-foreground/70 hover:text-foreground rounded-full p-1.5"
              >
                <icon.Pin className="size-4" />
              </TooltipButton>
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
    <div className="flex shrink-0 flex-col items-center gap-4">
      <div className="flex flex-wrap items-start justify-center gap-4">
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

      <CoverColorsEditor book={book} />
    </div>
  )
}
