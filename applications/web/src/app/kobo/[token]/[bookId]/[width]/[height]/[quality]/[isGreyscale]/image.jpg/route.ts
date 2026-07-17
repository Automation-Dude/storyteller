import { NextResponse } from "next/server"

import { getExtractedCover } from "@/assets/covers"
import { getCachedCoverImage, writeCachedCoverImage } from "@/assets/fs"
import { type BookWithRelations, getBook } from "@/database/books"
import { resizeCoverForReader } from "@/images"
import { getKoboDeviceByToken } from "@/kobo/devices"
import { logger } from "@/logging"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

type Params = Promise<{
  token: string
  bookId: string
  width: string
  height: string
  quality: string
  isGreyscale: string
}>

/** Where a Kobo's own covers come from. */
const KOBO_IMAGE_HOST = "https://cdn.kobo.com/book-images"

/**
 * The cover at the size the device asked for, resized once and kept.
 *
 * A Kobo asks for a thumbnail and will happily accept the full sized cover,
 * which is how this used to answer. That makes her device pull a megapixel
 * JPEG over wifi and downscale it on an e-ink CPU, once per book, and with a
 * library this size that is the difference between a shelf that fills in and
 * one that crawls. Resizing costs us once per book and size; not resizing
 * costs her every time she scrolls.
 *
 * This is the same cache the web reader fills, so a cover sized for her Kobo
 * is not re-rendered for the app, or the other way round.
 */
async function coverForDevice(
  book: BookWithRelations,
  height: number,
  width: number,
) {
  for (const [cacheKind, coverKind] of [
    ["text", "ebook"],
    ["audio", "audiobook"],
  ] as const) {
    if (height && width) {
      const cached = await getCachedCoverImage(
        book.uuid,
        cacheKind,
        height,
        width,
      )
      if (cached) return cached
    }

    const cover = await getExtractedCover(book, coverKind)
    if (!cover) continue
    if (!height || !width) return cover

    try {
      cover.data = await resizeCoverForReader(cover.data, width, height)
      // Always JPEG after resizing, whatever the source was (including a GIF),
      // so the device is told the truth about the bytes it is getting.
      cover.mimeType = "image/jpeg"
      await writeCachedCoverImage(book.uuid, cacheKind, height, width, cover)
    } catch (error) {
      // A cover we cannot resize (a format sharp will not decode) is still a
      // cover: serve the original rather than fall through to no cover at all.
      logger.warn(
        `Kobo cover: could not resize ${cover.filename} for ${book.uuid}: ${String(error)}`,
      )
    }
    return cover
  }

  return null
}

/**
 * @summary Book cover for a Kobo
 * @desc The device builds this URL itself from the CoverImageId in a book's
 *       metadata, which is why the size and greyscale flags are in the path
 *       rather than the query.
 *
 *       Once we tell a device to fetch covers from us, it asks us for *every*
 *       cover, including the books she bought from Kobo, which we have never
 *       heard of. Those are sent back to Kobo's own image host rather than
 *       answered with a blank: claiming the image host must not cost her the
 *       covers of her own books.
 *
 *       The greyscale flag is ignored on purpose: her Kobo is a colour device,
 *       and it can grey down a colour cover if it ever wants one.
 */
export async function GET(_request: Request, context: { params: Params }) {
  const { token, bookId, width, height } = await context.params

  const device = await getKoboDeviceByToken(token)
  if (!device) return new NextResponse(null, { status: 404 })

  // Her Kobo purchases keep their covers: not our book, not our cover to serve.
  const kobosOwn = NextResponse.redirect(
    `${KOBO_IMAGE_HOST}/${bookId}/${width}/${height}/false/image.jpg`,
    307,
  )

  const book = await getBook(bookId as UUID, device.userId as UUID)
  if (!book) return kobosOwn

  const requestedHeight = Number.parseInt(height, 10)
  const requestedWidth = Number.parseInt(width, 10)
  const cover = await coverForDevice(
    book,
    Number.isNaN(requestedHeight) ? 0 : requestedHeight,
    Number.isNaN(requestedWidth) ? 0 : requestedWidth,
  )
  if (!cover) return kobosOwn

  return new NextResponse(new Uint8Array(cover.data), {
    headers: {
      "Content-Type": cover.mimeType,
      "Content-Length": `${cover.data.length}`,
      // Covers change only when a book is re-imported, and the device asks for
      // them constantly while browsing.
      "Cache-Control": "private, max-age=86400",
    },
  })
}
