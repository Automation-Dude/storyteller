"use client"

import { cn } from "@v3/_/lib/utils"

import { Book3D, VIEWS } from "@/app/(v3)/v3/_/components/books/Book3D"
import { useTranslation } from "@/app/(v3)/v3/_/hooks/use-translation"
import {
  type DoubleCoverAlignment,
  type GridCoverDisplay,
} from "@/database/userPreferencesTypes"
import { type UUID } from "@/uuid"

const ebookGradient = "linear-gradient(150deg, #2563eb, #60a5fa)"
const audioGradient = "linear-gradient(150deg, #7c3aed, #c084fc)"

function MiniCover({
  variant,
  className,
  style,
}: {
  variant: "ebook" | "audiobook"
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={cn("rounded shadow-md", className)}
      style={{
        background: variant === "ebook" ? ebookGradient : audioGradient,
        ...style,
      }}
    />
  )
}

export function GridCoverPreview({
  display,
  alignment,
}: {
  display: GridCoverDisplay
  alignment: DoubleCoverAlignment
}) {
  const tilted = alignment === "auto"

  return (
    <div className="bg-muted flex aspect-11/16 w-28 shrink-0 items-center justify-center rounded-lg p-2">
      {display === "auto" && (
        <div className="relative flex h-full w-full items-center justify-center">
          <MiniCover
            variant="audiobook"
            className="absolute aspect-square h-1/2"
            style={{
              transform: `translateX(15%) scale(1)${tilted ? " rotate(2.5deg)" : ""}`,
            }}
          />
          <MiniCover
            variant="ebook"
            className="absolute aspect-[2/3] h-[80%]"
            style={{
              transform: `translateX(-10%) scale(1)${tilted ? " rotate(-2.5deg)" : ""}`,
            }}
          />
        </div>
      )}

      {display === "ebook" && (
        <MiniCover variant="ebook" className="h-full w-3/4" />
      )}

      {display === "audiobook" && (
        <MiniCover variant="audiobook" className="aspect-square w-full" />
      )}
    </div>
  )
}

export function FlatDetailPreview() {
  return (
    <div className="bg-muted flex aspect-11/16 w-28 shrink-0 items-center justify-center rounded-lg p-2">
      <div className="relative flex h-full w-full items-center justify-center">
        <MiniCover
          variant="audiobook"
          className="absolute aspect-square h-1/2"
          style={{ transform: "translateX(15%) scale(1)" }}
        />
        <MiniCover
          variant="ebook"
          className="absolute aspect-[2/3] h-[80%]"
          style={{ transform: "translateX(-10%) scale(1)" }}
        />
      </div>
    </div>
  )
}

export const VIEW_COUNT = VIEWS.length

const PAGE_EDGE =
  "repeating-linear-gradient(to bottom, #f8f5ec, #f8f5ec 2px, #e2ddcc 3px)"

type FaceColors = {
  front: string
  back: string
  spine: string
  edge: string
  cap: string
  radius: string
  backRadius: string
}

const FACE_COLORS: Record<"ebook" | "audiobook", FaceColors> = {
  ebook: {
    front: ebookGradient,
    back: "#1e40af",
    spine: "#1e3a8a",
    edge: PAGE_EDGE,
    cap: "#f3efe2",
    radius: "2px 6px 6px 2px",
    backRadius: "6px 2px 2px 6px",
  },
  audiobook: {
    front: audioGradient,
    back: "#5b21b6",
    spine: "#4c1d95",
    edge: "#a78bfa",
    cap: "#4c1d95",
    radius: "4px",
    backRadius: "4px",
  },
}

export function Book3DPositionPreview({
  ebookView,
  audiobookView,
  onViewChange,
}: {
  ebookView: number
  audiobookView: number
  onViewChange: (view: number, format: "ebook" | "audiobook") => void
}) {
  const t = useTranslation("PreferencesPage.tabs.books.sections.detail")
  return (
    <Book3D
      book={{
        uuid: "xxx" as UUID,
        title: "",
        description: "Hello!",

        coverColorsOverride: null,
        pageCount: null,
        duration: null,
        updatedAt: new Date().toISOString(),
        publicationDate: new Date().toISOString(),
        authors: [],
        readaloud: {
          coverBlurhash: null,
          duration: 24 * 60 * 60,
          fileSize: null,
          pageCount: 500,
          coverColors: [
            { r: 94, g: 33, b: 182 },
            { r: 192, g: 132, b: 252 },
          ],
          status: "ALIGNED",
        },
        ebook: {
          coverBlurhash: null,
          fileSize: null,
          updatedAt: new Date().toISOString(),
          pageCount: 500,
          coverColors: [
            { r: 30, g: 64, b: 175 },
            { r: 96, g: 165, b: 250 },
          ],
        },
        audiobook: {
          coverBlurhash: null,
          duration: 24 * 60 * 60,
          fileSize: null,
          updatedAt: new Date().toISOString(),
          coverColors: [
            { r: 94, g: 33, b: 182 },
            { r: 192, g: 132, b: 252 },
          ],
        },
      }}
      width={200}
      spine="title"
      initialViews={{ ebook: ebookView, audiobook: audiobookView }}
      onViewChange={onViewChange}
      slabActions={(format) => (
        <div>
          {t(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            `view.options.${VIEWS[format === "ebook" ? ebookView : audiobookView]!.key}`,
          )}
        </div>
      )}
    />
  )
}
