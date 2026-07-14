import { type NextRequest, NextResponse } from "next/server"

import { getSettings } from "@/database/settings"
import { getUserByUsernameOrEmail } from "@/database/users"
import {
  KOSYNC_ERRORS,
  kosyncError,
} from "@/koreader/auth"
import { createKoreaderUser, getKoreaderUser } from "@/koreader/database"
import { logger } from "@/logging"

export const dynamic = "force-dynamic"

type CreateBody = {
  username?: string
  password?: string
}

/**
 * @summary Register a KOReader sync account
 * @desc kosync's POST /users/create. The password arrives already md5 hashed
 *       by the device, so it is stored as the auth key and never compared
 *       against the Storyteller password.
 *
 *       KOReader's client only accepts 201 and 402 here; any other status is a
 *       transport error on the device.
 */
export async function POST(request: NextRequest) {
  const settings = await getSettings()
  if (!settings.koreaderSyncEnabled) {
    return kosyncError(KOSYNC_ERRORS.registrationDisabled, 402)
  }
  if (!settings.koreaderSyncAllowRegistration) {
    return kosyncError(KOSYNC_ERRORS.registrationDisabled, 402)
  }

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return kosyncError(KOSYNC_ERRORS.invalidRequest, 402)
  }

  const { username, password } = body
  // A colon is illegal in the reference server's key fields; reject it rather
  // than store something that will not round-trip.
  if (!username || !password || username.includes(":")) {
    return kosyncError(KOSYNC_ERRORS.invalidRequest, 402)
  }

  if (await getKoreaderUser(username)) {
    return kosyncError(KOSYNC_ERRORS.usernameTaken, 402)
  }

  // The KOReader account is bound to an existing Storyteller user, matched by
  // username or email. Without that binding there is no library to sync
  // against, and self-registration would let anyone create an account.
  const user = await getUserByUsernameOrEmail(username)
  if (!user) {
    return kosyncError(KOSYNC_ERRORS.invalidRequest, 402)
  }

  await createKoreaderUser(user.id, username, password)
  logger.info(`Registered KOReader sync account for ${username}`)

  return NextResponse.json({ username }, { status: 201 })
}
