import { type BookWithRelations } from "@/database/books"

import { useCoverColors } from "./BookDetails/sections/useCoverColors"

export function ProgressBar({
  progress,
  book,
}: {
  progress: number
  book: BookWithRelations
}) {
  const { accent } = useCoverColors(book)?.[0]

  return (
    <div className="absolute right-0 bottom-0 left-0 h-1 bg-black/30">
      <div
        className="h-full transition-all"
        style={{
          width: `${progress * 100}%`,
          background: accent ?? "var(--primary)",
        }}
      />
    </div>
  )
}
