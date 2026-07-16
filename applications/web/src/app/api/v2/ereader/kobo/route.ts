import { NextResponse } from "next/server"
import { z } from "zod"

import { withHasPermission } from "@/auth/auth"
import { getSettings } from "@/database/settings"
import { getDeviceVerificationBaseUrl } from "@/deviceAuthorization"
import { createKoboDevice } from "@/kobo/devices"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

const BodySchema = z.object({
  deviceLabel: z.string().trim().min(1).optional(),
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

  const baseUrl = await getDeviceVerificationBaseUrl(request.nextUrl.origin)
  const { token } = await createKoboDevice({
    userId: request.auth.user.id,
    label: parsed.data.deviceLabel ?? "Kobo",
    collectionUuid: (parsed.data.collectionUuid ?? null) as UUID | null,
  })

  return NextResponse.json({
    // The device is configured by replacing exactly this line in its config.
    apiEndpoint: `${baseUrl.replace(/\/+$/, "")}/kobo/${token}`,
  })
})
