import { NextResponse } from "next/server"

import { getBook } from "@/database/books"
import { getKoboDeviceByToken } from "@/kobo/devices"
import { bridgeKoboStateToPosition } from "@/kobo/positions"
import { logger } from "@/logging"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

type Params = Promise<{ token: string; bookId: string }>

type KoboBookmark = {
  ProgressPercent?: number
  ContentSourceProgressPercent?: number
  Location?: { Value?: string } | null
}

type KoboReadingState = {
  CurrentBookmark?: KoboBookmark | null
  LastModified?: string
}

/**
 * @summary Kobo reading state
 * @desc Where the device is in a book. The Kobo PUTs this as she reads, which
 *       is what carries her place back to Storyteller so the apps can pick it
 *       up, and GETs it so a book opened on a fresh device starts where she
 *       left off elsewhere.
 */
export async function GET(_request: Request, context: { params: Params }) {
  const { token, bookId } = await context.params

  const device = await getKoboDeviceByToken(token)
  if (!device)
    return NextResponse.json({ message: "Not found" }, { status: 404 })

  const book = await getBook(bookId as UUID, device.userId as UUID)
  if (!book) return NextResponse.json({ message: "Not found" }, { status: 404 })

  const now = new Date().toISOString()
  return NextResponse.json([
    {
      EntitlementId: book.uuid,
      Created: now,
      LastModified: now,
      StatusInfo: { LastModified: now, Status: "ReadyToRead" },
    },
  ])
}

export async function PUT(request: Request, context: { params: Params }) {
  const { token, bookId } = await context.params

  const device = await getKoboDeviceByToken(token)
  if (!device)
    return NextResponse.json({ message: "Not found" }, { status: 404 })

  const book = await getBook(bookId as UUID, device.userId as UUID)
  if (!book) return NextResponse.json({ message: "Not found" }, { status: 404 })

  const body = (await request.json().catch(() => null)) as {
    ReadingStates?: KoboReadingState[]
  } | null
  const state = body?.ReadingStates?.[0]
  const bookmark = state?.CurrentBookmark

  if (bookmark && typeof bookmark.ProgressPercent === "number") {
    // `state` is non-null here: bookmark came off it and is truthy.
    const modified = state.LastModified
      ? new Date(state.LastModified).valueOf()
      : Date.now()

    await bridgeKoboStateToPosition({
      userId: device.userId as UUID,
      bookUuid: book.uuid,
      progressPercent: bookmark.ProgressPercent,
      location: bookmark.Location?.Value ?? null,
      timestamp: Number.isNaN(modified) ? Date.now() : modified,
    })
  } else {
    logger.debug(`Kobo state for ${bookId} carried no bookmark; nothing to do`)
  }

  // The device expects each part it sent to be acknowledged. Anything it does
  // not see acknowledged, it will send again.
  return NextResponse.json({
    RequestResult: "Success",
    UpdateResults: [
      {
        EntitlementId: book.uuid,
        CurrentBookmarkResult: { Result: "Success" },
        StatisticsResult: { Result: "Success" },
        StatusInfoResult: { Result: "Success" },
      },
    ],
  })
}
