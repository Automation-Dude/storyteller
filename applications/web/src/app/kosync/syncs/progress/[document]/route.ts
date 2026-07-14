import { NextResponse } from "next/server"

import { type UUID } from "@/uuid"
import { type KoreaderRequest, withKoreaderAuth } from "@/koreader/auth"
import { getKoreaderProgress } from "@/koreader/database"

export const dynamic = "force-dynamic"

type Params = Promise<{
  document: string
}>

/**
 * @summary Pull reading progress for a document
 * @desc kosync's GET /syncs/progress/:document. The client accepts 200 and 401
 *       only, so an unknown document answers 200 with an empty object rather
 *       than 404. KOReader branches on the absence of `percentage` to show its
 *       "no progress found" message.
 */
export const GET = withKoreaderAuth<Params>(
  async (request: KoreaderRequest, context) => {
    const { document } = await context.params

    const progress = await getKoreaderProgress(
      request.koreader.userUuid as UUID,
      document,
    )

    if (!progress) {
      return NextResponse.json({}, { status: 200 })
    }

    return NextResponse.json(
      {
        document: progress.document,
        progress: progress.progress,
        percentage: progress.percentage,
        device: progress.device,
        device_id: progress.deviceId,
        timestamp: progress.timestamp,
      },
      { status: 200 },
    )
  },
)
