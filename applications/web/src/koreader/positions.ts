import {
  PositionConflictError,
  type ReadiumLocator,
  upsertPosition,
} from "@/database/positions"
import { logger } from "@/logging"
import { type UUID } from "@/uuid"

/**
 * KOReader's `progress` is engine specific and opaque: a CREngine XPointer for
 * reflowable books, a page number for paged ones. It is not a Readium locator
 * and cannot be converted into one, so it is preserved verbatim in the
 * koreader_progress table and only the percentage is bridged across.
 *
 * `totalProgression` is what drives Storyteller's own "Reading" and "Read"
 * status transitions, so mapping the percentage keeps a book read on a Kobo in
 * step with the apps.
 */
export function koreaderProgressToLocator(
  percentage: number,
  progress: string,
): ReadiumLocator {
  return {
    href: "",
    type: "application/xhtml+xml",
    title: "KOReader",
    locations: {
      totalProgression: percentage,
      progression: percentage,
      // KOReader's own position, kept so a future KOReader-aware client can
      // restore the exact spot rather than the approximate one.
      fragments: [progress],
    },
  }
}

/**
 * Mirror a KOReader progress push into Storyteller's position table. Failures
 * here must not fail the sync call itself: the e-reader's own progress is
 * already stored, and kosync's status codes are a hard contract.
 */
export async function bridgeProgressToPosition(
  userId: UUID,
  bookUuid: UUID,
  percentage: number,
  progress: string,
  timestamp: number,
) {
  const locator = koreaderProgressToLocator(percentage, progress)

  try {
    // kosync timestamps are unix seconds; Storyteller positions are ms.
    await upsertPosition(userId, bookUuid, locator, timestamp * 1000)
  } catch (e) {
    if (e instanceof PositionConflictError) {
      logger.info(
        "KOReader progress is older than the stored Storyteller position, keeping the newer one",
      )
      return
    }
    // A book the user has never opened in Storyteller has no status row, which
    // upsertPosition requires. That is expected for a sideloaded e-reader read.
    logger.warn(`Could not bridge KOReader progress to a position: ${String(e)}`)
  }
}
