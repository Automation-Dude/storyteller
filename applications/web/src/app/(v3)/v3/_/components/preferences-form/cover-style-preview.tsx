"use client"

import { cn } from "@v3/_/lib/utils"

import {
  type BookDetailDisplay,
  type DoubleCoverAlignment,
  type GridCoverDisplay,
} from "@/database/userPreferencesTypes"

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

export function DetailDisplayPreview({
  display,
}: {
  display: BookDetailDisplay
}) {
  if (display === "3d") {
    return (
      <div className="bg-muted flex aspect-square w-28 shrink-0 items-center justify-center rounded-lg p-3">
        <div
          className="aspect-[2/3] h-full rounded shadow-lg"
          style={{
            background: ebookGradient,
            transform: "perspective(400px) rotateY(-15deg)",
            transformOrigin: "left center",
          }}
        />
      </div>
    )
  }

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
