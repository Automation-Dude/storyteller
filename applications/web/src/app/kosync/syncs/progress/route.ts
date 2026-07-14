import { NextResponse } from "next/server"

import { type UUID } from "@/uuid"
import {
  KOSYNC_ERRORS,
  type KoreaderRequest,
  kosyncError,
  withKoreaderAuth,
} from "@/koreader/auth"
import {
  getBookUuidForDocument,
  upsertKoreaderProgress,
} from "@/koreader/database"
import { bridgeProgressToPosition } from "@/koreader/positions"

export const dynamic = "force-dynamic"

type ProgressBody = {
  document?: string
  progress?: unknown
  percentage?: number
  device?: string
  device_id?: string
}

/**
 * @summary Push reading progress from a KOReader device
 * @desc kosync's PUT /syncs/progress. The client accepts 200, 202 and 401
 *       only. The timestamp is assigned by the server; KOReader never sends
 *       one, and it compares that timestamp against its own clock to decide
 *       sync direction.
 */
export const PUT = withKoreaderAuth(async (request: KoreaderRequest) => {
  let body: ProgressBody
  try {
    body = (await request.json()) as ProgressBody
  } catch {
    return kosyncError(KOSYNC_ERRORS.invalidRequest, 401)
  }

  const { document, percentage, device, device_id: deviceId } = body
  // `progress` is always a string on the wire (an XPointer, or a page number
  // for paged formats). Preserve it byte for byte.
  const progress =
    typeof body.progress === "string" ? body.progress : String(body.progress)

  if (!document || document.includes(":") || typeof percentage !== "number") {
    return kosyncError(KOSYNC_ERRORS.invalidRequest, 401)
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const bookUuid = await getBookUuidForDocument(document)

  await upsertKoreaderProgress(
    request.koreader.userUuid as UUID,
    {
      document,
      progress,
      percentage,
      device: device ?? null,
      deviceId: deviceId ?? null,
      timestamp,
    },
    bookUuid as UUID | null,
  )

  // When the document is one of ours, mirror the progress onto the book so the
  // apps and the web reader move with the e-reader.
  if (bookUuid) {
    await bridgeProgressToPosition(
      request.koreader.userId as UUID,
      bookUuid as UUID,
      percentage,
      progress,
      timestamp,
    )
  }

  return NextResponse.json({ document, timestamp }, { status: 200 })
})
