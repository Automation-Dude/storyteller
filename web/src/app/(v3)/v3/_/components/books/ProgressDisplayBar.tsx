import { type BookWithRelations } from "@/database/books"

import {
  ensureContrast,
  useColorPreferences,
  useCoverColors,
} from "./BookDetails/sections/useCoverColors"
import { cn } from "@/cn"

// the seeded "finished" reading status. a book marked read counts as fully
// read regardless of any saved position (it may have none).
const READ_STATUS_NAME = "Read"

export function isBookFinished(book: BookWithRelations): boolean {
  return book.status?.name === READ_STATUS_NAME
}

// reading progress as a 0-1 fraction, or null when there's nothing to show.
// a finished book always reads as 100%.
export function getReadingProgress(book: BookWithRelations): number | null {
  if (isBookFinished(book)) return 1
  return book.position?.locator.locations?.totalProgression ?? null
}

export function ProgressDisplayBar({
  progress,
  book,
  className,
}: {
  progress: number
  book: BookWithRelations
  className?: string
}) {
  const { primary } = useCoverColors(book)
  const { showAccent } = useColorPreferences()

  return (
    <div
      className={cn(
        "absolute right-0.5 bottom-0 left-0.5 h-1 overflow-hidden rounded-b-lg bg-black/30",
        className,
      )}
    >
      <div
        className="h-full transition-all"
        style={{
          width: `${progress * 100}%`,
          // the bar sits on a dark track, so lighten the cover color enough to
          // read against it (treat the surface as dark regardless of theme)
          background: showAccent
            ? ensureContrast(primary, true).solid
            : "var(--primary)",
        }}
      />
    </div>
  )
}
