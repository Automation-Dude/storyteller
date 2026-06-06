import { type BookWithRelations } from "@/database/books"

import {
  useColorPreferences,
  useCoverColors,
} from "./BookDetails/sections/useCoverColors"

export function ProgressDisplayBar({
  progress,
  book,
}: {
  progress: number
  book: BookWithRelations
}) {
  const { primary } = useCoverColors(book)
  const { showAccent } = useColorPreferences()

  return (
    <div className="absolute right-0 bottom-0 left-0 h-1 bg-black/30">
      <div
        className="h-full transition-all"
        style={{
          width: `${progress * 100}%`,
          background: showAccent ? primary.solid : "var(--primary)",
        }}
      />
    </div>
  )
}
