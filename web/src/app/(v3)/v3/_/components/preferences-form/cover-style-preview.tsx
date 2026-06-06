"use client"

import { cn } from "@v3/_/lib/utils"

import { type GridCoverDisplay } from "@/database/userPreferencesTypes"

// schematic covers so the layout difference is legible without real artwork
const ebookGradient = "linear-gradient(150deg, #2563eb, #60a5fa)"
const audioGradient = "linear-gradient(150deg, #7c3aed, #c084fc)"

function MiniCover({
  variant,
  className,
}: {
  variant: "ebook" | "audiobook"
  className?: string
}) {
  return (
    <div
      className={cn("rounded shadow-md", className)}
      style={{
        background: variant === "ebook" ? ebookGradient : audioGradient,
      }}
    />
  )
}

export function CoverStylePreview({ display }: { display: GridCoverDisplay }) {
  return (
    <div className="bg-muted flex aspect-13/16 w-28 shrink-0 items-center justify-center rounded-lg p-2">
      {display === "auto" && (
        <div className="relative flex h-full w-full items-center justify-center">
          <MiniCover variant="ebook" className="h-[88%] w-1/2 -rotate-6" />
          <MiniCover
            variant="audiobook"
            className="aspect-square h-1/2 translate-x-3 translate-y-3 rotate-6"
          />
        </div>
      )}
      {display === "ebook" && <MiniCover variant="ebook" className="h-full w-3/4" />}
      {display === "audiobook" && (
        <MiniCover variant="audiobook" className="aspect-square w-full" />
      )}
    </div>
  )
}
