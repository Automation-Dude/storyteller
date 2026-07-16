import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { getSettings } from "@/database/settings"
import {
  INSTALLER,
  PACKAGES,
  type PackageName,
  getKfmonInstaller,
  getPackage,
} from "@/ereader/packages"
import { logger } from "@/logging"

export const dynamic = "force-dynamic"

type Params = Promise<{
  name: string
}>

/**
 * The launcher's installer is built from the pinned KFMon package rather than
 * downloaded, so it is served by name alongside the packages themselves.
 */
const KFMON_INSTALLER = "kfmon-installer"

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
  const isInstaller = name === KFMON_INSTALLER
  if (!isInstaller && !(name in PACKAGES)) {
    return NextResponse.json({ message: "Unknown package" }, { status: 404 })
  }

  const spec = isInstaller ? INSTALLER : PACKAGES[name as PackageName]

  let bytes: Buffer
  try {
    bytes = isInstaller
      ? await getKfmonInstaller()
      : await getPackage(name as PackageName)
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
