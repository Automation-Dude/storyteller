import { NextResponse } from "next/server"
import { z } from "zod"

import { withHasPermission } from "@/auth/auth"
import { getSettings } from "@/database/settings"
import { getUser } from "@/database/users"
import { getDeviceVerificationBaseUrl } from "@/deviceAuthorization"
import { createKoboDevice } from "@/kobo/devices"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

const BodySchema = z.object({
  deviceLabel: z.string().trim().min(1).optional(),
  /**
   * Who the device is for. Setting up someone else's e-reader is the normal
   * case, not the exception: whoever has the device in hand is usually not
   * the person who reads on it.
   */
  userId: z.string().optional(),
  /** The shelf this device sees. Omitted means the whole library. */
  collectionUuid: z.uuid().optional(),
})

/**
 * @summary Provision a Kobo and return its api_endpoint
 * @desc Registers the device and returns the single line to write into its
 *       Kobo eReader.conf. Nothing is installed on the device: pointing its
 *       api_endpoint here is what makes books put on its shelf appear in its
 *       own library, in its own reader.
 */
export const POST = withHasPermission("bookDownload")(async (request) => {
  const settings = await getSettings()
  if (!settings.koboSyncEnabled) {
    return NextResponse.json(
      { message: "Kobo sync is disabled; enable it to set up a Kobo." },
      { status: 409 },
    )
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const caller = request.auth.user
  const targetUserId = parsed.data.userId ?? caller.id

  // Binding a device to the wrong account fails silently and badly: the
  // reader's place would sync into someone else's library, and they would only
  // find out by noticing their own books jumping around. So doing it for
  // someone else is explicit, and allowed only to someone who may already see
  // the accounts.
  if (targetUserId !== caller.id) {
    if (!caller.permissions?.userList) {
      return NextResponse.json(
        { message: "You cannot set up an e-reader for another user." },
        { status: 403 },
      )
    }
    const target = await getUser(targetUserId as UUID)
    if (!target) {
      return NextResponse.json(
        { message: "That user does not exist." },
        { status: 404 },
      )
    }
  }

  const baseUrl = await getDeviceVerificationBaseUrl(request.nextUrl.origin)
  const { token } = await createKoboDevice({
    userId: targetUserId as UUID,
    label: parsed.data.deviceLabel ?? "Kobo",
    collectionUuid: (parsed.data.collectionUuid ?? null) as UUID | null,
  })

  return NextResponse.json({
    // The device is configured by replacing exactly this line in its config.
    apiEndpoint: `${baseUrl.replace(/\/+$/, "")}/kobo/${token}`,
  })
})
