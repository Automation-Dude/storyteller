import {
  PositionConflictError,
  type ReadiumLocator,
  upsertPosition,
} from "@/database/positions"
import { logger } from "@/logging"
import { type UUID } from "@/uuid"

/**
 * A Kobo reports where it is as a percentage plus an opaque location: a
 * "KoboSpan" id that only means something against the kepub the device is
 * reading. It is not a Readium locator and cannot be converted into one, so it
 * is kept verbatim and only the percentage is bridged across.
 *
 * `totalProgression` is what drives Storyteller's own "Reading" and "Read"
 * status transitions, so mapping the percentage is what makes a book she reads
 * on the Kobo pick up where she left off in the apps.
 *
 * This mirrors the KOReader bridge deliberately: same compromise, same reason.
 */
export function koboProgressToLocator(
  /** Kobo sends 0..100; Readium wants 0..1. */
  progressPercent: number,
  location: string | null,
): ReadiumLocator {
  const progression = Math.min(Math.max(progressPercent / 100, 0), 1)
  return {
    href: "",
    type: "application/xhtml+xml",
    title: "Kobo",
    locations: {
      totalProgression: progression,
      progression,
      // The device's own span, kept so a future Kobo-aware client can restore
      // the exact spot rather than the approximate one.
      ...(location ? { fragments: [location] } : {}),
    },
  }
}

/**
 * Mirror a Kobo reading state into Storyteller's position table.
 *
 * Failures here must not fail the sync call: the device's own state is already
 * accepted, and a Kobo that gets an error back will retry the whole state push
 * rather than move on.
 */
export async function bridgeKoboStateToPosition(args: {
  userId: UUID
  bookUuid: UUID
  progressPercent: number
  location: string | null
  /** Milliseconds. Kobo sends ISO timestamps, not unix seconds. */
  timestamp: number
}): Promise<void> {
  const locator = koboProgressToLocator(args.progressPercent, args.location)

  try {
    await upsertPosition(args.userId, args.bookUuid, locator, args.timestamp)
  } catch (e) {
    if (e instanceof PositionConflictError) {
      logger.info(
        "Kobo progress is older than the stored Storyteller position, keeping the newer one",
      )
      return
    }
    // A book never opened in Storyteller has no status row, which
    // upsertPosition requires. Expected for a book only ever read on the Kobo.
    logger.warn(`Could not bridge Kobo progress to a position: ${String(e)}`)
  }
}
