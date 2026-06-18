import { type BookWithRelations } from "@/database/books"

import {
  ensureContrast,
  useColorPreferences,
  useCoverColors,
} from "./BookDetails/sections/useCoverColors"
import { cn } from "@/cn"

// TODO: change this when we allow users to change the status names
const READ_STATUS_NAME = "Read"

export function isBookFinished(book: BookWithRelations): boolean {
  return book.status?.name === READ_STATUS_NAME
}

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
    <div className={cn("h-1 w-full bg-black/5", className)}>
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
