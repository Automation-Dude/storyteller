import { NextResponse } from "next/server"

import { getSettings } from "@/database/settings"
import { getKoboDeviceByToken, touchKoboDeviceSync } from "@/kobo/devices"
import { buildSync, commitSync } from "@/kobo/sync"
import { logger } from "@/logging"

export const dynamic = "force-dynamic"

type Params = Promise<{ token: string }>

/**
 * @summary Kobo library sync
 * @desc The endpoint a Kobo calls to find out what is in its library. The
 *       device is pointed here by its api_endpoint, and authenticates with the
 *       token in the path rather than a session, because that is all a Kobo
 *       can be configured to send.
 */
export async function GET(request: Request, context: { params: Params }) {
  const { token } = await context.params

  const settings = await getSettings()
  if (!settings.koboSyncEnabled) {
    return NextResponse.json(
      { message: "Kobo sync is disabled." },
      { status: 409 },
    )
  }

  const device = await getKoboDeviceByToken(token)
  if (!device) {
    // Unknown or revoked. Say nothing about which.
    return NextResponse.json({ message: "Not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const baseUrl = `${url.origin}/kobo/${token}`

  try {
    const { items, hasMore, bookUuids } = await buildSync({ device, baseUrl })

    // Only record what went out after it is built, so a failure mid-build does
    // not leave books marked as sent that the device never saw.
    await commitSync(device, bookUuids)
    await touchKoboDeviceSync(device.uuid)

    const response = NextResponse.json(items)
    // Tells the device to come straight back for the next batch.
    response.headers.set("x-kobo-sync", hasMore ? "continue" : "done")
    response.headers.set("x-kobo-synctoken", new Date().toISOString())
    return response
  } catch (e) {
    logger.error({ msg: "Kobo sync failed", device: device.uuid, err: e })
    return NextResponse.json({ message: "Sync failed" }, { status: 500 })
  }
}
