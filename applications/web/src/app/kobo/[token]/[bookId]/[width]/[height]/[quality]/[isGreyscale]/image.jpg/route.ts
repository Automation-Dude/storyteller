import { NextResponse } from "next/server"

import { getExtractedCover } from "@/assets/covers"
import { getBook } from "@/database/books"
import { getKoboDeviceByToken } from "@/kobo/devices"
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
 *       The dimensions are accepted and ignored: the device scales what it is
 *       given, and resizing here would cost CPU on every cover of every sync
 *       to produce something it is about to resize anyway.
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

  // Prefer the ebook's own cover; a Kobo only ever shows ebooks.
  const cover =
    (await getExtractedCover(book, "ebook")) ??
    (await getExtractedCover(book, "audiobook"))
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
