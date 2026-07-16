import { NextResponse } from "next/server"

import { getBook } from "@/database/books"
import { getKoboDeviceByToken } from "@/kobo/devices"
import { type KoboDownloadUrl, buildKoboMetadata } from "@/kobo/metadata"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

type Params = Promise<{ token: string; bookId: string }>

/**
 * @summary Metadata for one book
 * @desc The device asks for this when it wants a book's details on their own,
 *       rather than as part of a sync.
 */
export async function GET(request: Request, context: { params: Params }) {
  const { token, bookId } = await context.params

  const device = await getKoboDeviceByToken(token)
  if (!device)
    return NextResponse.json({ message: "Not found" }, { status: 404 })

  const book = await getBook(bookId as UUID, device.userId as UUID)
  if (!book?.ebook) {
    return NextResponse.json({ message: "Not found" }, { status: 404 })
  }

  const origin = new URL(request.url).origin
  const downloadUrls: KoboDownloadUrl[] = [
    {
      Format: "EPUB3",
      Size: book.ebook.fileSize ?? 0,
      Url: `${origin}/kobo/${token}/download/${book.uuid}`,
      Platform: "Generic",
    },
  ]

  // The device expects a list here, even for a single book.
  return NextResponse.json([buildKoboMetadata(book, downloadUrls)])
}
