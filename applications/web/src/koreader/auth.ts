import { timingSafeEqual } from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"

import { getSettings } from "@/database/settings"
import { getKoreaderUser } from "@/koreader/database"

export type KoreaderRequest = NextRequest & {
  koreader: { userUuid: string; userId: string }
}

/**
 * kosync error bodies are `{code, message}`; KOReader renders `message` to the
 * user. See config/errors.lua in koreader-sync-server.
 */
export const KOSYNC_ERRORS = {
  unauthorized: { code: 2001, message: "Unauthorized" },
  usernameTaken: { code: 2002, message: "Username is already registered." },
  invalidRequest: { code: 2003, message: "Invalid request." },
  registrationDisabled: {
    code: 2005,
    message: "User registration is disabled.",
  },
} as const

export function kosyncError(
  error: (typeof KOSYNC_ERRORS)[keyof typeof KOSYNC_ERRORS],
  status: number,
) {
  return NextResponse.json(error, { status })
}

function keysMatch(a: string, b: string) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * kosync authenticates every call with the x-auth-user and x-auth-key headers,
 * where the key is an md5 of the password computed on the device. There is no
 * session and no token, so this cannot reuse Storyteller's normal auth.
 *
 * Status codes are a hard contract: KOReader's Spore client raises on any
 * status outside the set the endpoint declares, so these handlers must answer
 * only 200/201/401/402 as appropriate. Never 404, never a redirect.
 */
export function withKoreaderAuth<Params>(
  handler: (
    request: KoreaderRequest,
    context: { params: Promise<Params> },
  ) => Promise<Response> | Response,
) {
  return async (
    request: NextRequest,
    context: { params: Promise<Params> },
  ): Promise<Response> => {
    const settings = await getSettings()
    if (!settings.koreaderSyncEnabled) {
      return kosyncError(KOSYNC_ERRORS.unauthorized, 401)
    }

    const username = request.headers.get("x-auth-user")
    const key = request.headers.get("x-auth-key")
    if (!username || !key) {
      return kosyncError(KOSYNC_ERRORS.unauthorized, 401)
    }

    const koreaderUser = await getKoreaderUser(username)
    if (!koreaderUser || !keysMatch(koreaderUser.authKey, key)) {
      return kosyncError(KOSYNC_ERRORS.unauthorized, 401)
    }

    return handler(
      Object.assign(request, {
        koreader: {
          userUuid: koreaderUser.uuid,
          userId: koreaderUser.userId,
        },
      }) as KoreaderRequest,
      context,
    )
  }
}
