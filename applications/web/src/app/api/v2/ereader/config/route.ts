import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { getSettings } from "@/database/settings"
import { getDeviceVerificationBaseUrl } from "@/deviceAuthorization"
import { provisionEreader } from "@/ereader/provision"

export const dynamic = "force-dynamic"

type Body = {
  deviceLabel?: string
}

/**
 * @summary Provision this user's e-reader and return its KOReader config
 * @desc Creates a per-device library credential and rotates the user's sync
 *       key, then returns the opds.lua and kosync.lua contents to write onto
 *       the device. No real password is ever issued or returned. Requires OPDS
 *       and KOReader sync to be enabled on the server.
 */
export const POST = withHasPermission("bookDownload")(async (request) => {
  const settings = await getSettings()
  if (!settings.opdsEnabled) {
    return NextResponse.json(
      { message: "The OPDS feed is disabled; enable it to set up an e-reader." },
      { status: 409 },
    )
  }
  if (!settings.koreaderSyncEnabled) {
    return NextResponse.json(
      {
        message:
          "KOReader sync is disabled; enable it to set up an e-reader.",
      },
      { status: 409 },
    )
  }

  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    // An empty body is fine; the label just defaults.
  }

  const deviceLabel = (body.deviceLabel ?? "").trim() || "E-reader"
  const user = request.auth.user

  // The device authenticates with this identifier; both OPDS and kosync resolve
  // the user by username or email, so either works.
  const identifier = user.username ?? user.email
  if (!identifier) {
    return NextResponse.json(
      { message: "Your account needs a username or email to set up a device." },
      { status: 409 },
    )
  }

  const baseUrl = await getDeviceVerificationBaseUrl(request.nextUrl.origin)

  const result = await provisionEreader({
    userId: user.id,
    username: identifier,
    libraryName: settings.libraryName || "Storyteller",
    deviceLabel,
    baseUrl,
  })

  return NextResponse.json(result)
})
