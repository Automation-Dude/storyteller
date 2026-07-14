import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { getSettings } from "@/database/settings"
import { PACKAGES, type PackageName, getPackage } from "@/ereader/packages"
import { logger } from "@/logging"

export const dynamic = "force-dynamic"

type Params = Promise<{
  name: string
}>

/**
 * @summary Serve a device package (KOReader or the KFMon launcher)
 * @desc Streams the cached, version-pinned package so the setup page can write
 *       it to a plugged-in e-reader without a cross-origin fetch. Requires
 *       KOReader sync to be enabled.
 */
export const GET = withHasPermission<Params>("bookDownload")(async (
  _request,
  context,
) => {
  const settings = await getSettings()
  if (!settings.koreaderSyncEnabled) {
    return NextResponse.json(
      { message: "KOReader sync is disabled." },
      { status: 409 },
    )
  }

  const { name } = await context.params
  if (!(name in PACKAGES)) {
    return NextResponse.json({ message: "Unknown package" }, { status: 404 })
  }

  const spec = PACKAGES[name as PackageName]

  let bytes: Buffer
  try {
    bytes = await getPackage(name as PackageName)
  } catch (e) {
    logger.error(e)
    return NextResponse.json(
      { message: "Could not retrieve the device package." },
      { status: 502 },
    )
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": spec.contentType,
      "Content-Length": `${bytes.length}`,
      "Content-Disposition": `attachment; filename="${spec.filename}"`,
      // Version-pinned and immutable; safe for the browser to cache.
      "Cache-Control": "private, max-age=86400",
    },
  })
})
