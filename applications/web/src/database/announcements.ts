import {
  ANNOUNCEMENTS,
  type Announcement,
  dismissalKey,
} from "@/announcement-builtins"
import type { UUID } from "@/uuid"
import { BETA_TAGS, getCurrentVersion } from "@/versions"

import { getUserSettings } from "./userSettings"

function isBetaBuild(): boolean {
  const version = getCurrentVersion()
  return BETA_TAGS.some((tag) => version.includes(tag))
}

// the announcements this user should still see: builtins that apply to this
// build and haven't been dismissed. resolved on the server so the modal can be
// seeded without a fetch flash (see "server-resolve initial data").
export async function getPendingAnnouncements(
  userId: UUID,
): Promise<Announcement[]> {
  const settings = await getUserSettings(userId)
  const beta = isBetaBuild()

  return ANNOUNCEMENTS.filter((announcement) => {
    if (announcement.onlyBeta && !beta) return false
    return !settings[dismissalKey(announcement.key)]
  })
}
