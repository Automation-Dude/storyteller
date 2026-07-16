import { createReadStream } from "node:fs"
import { open } from "node:fs/promises"
import { Readable } from "node:stream"

import { NextResponse } from "next/server"

import { type BookFormat, getBook, markFormatMissing } from "@/database/books"
import { getKoboDeviceByToken } from "@/kobo/devices"
import { logger } from "@/logging"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

type Params = Promise<{ token: string; bookId: string }>

/**
 * @summary Download a book to a Kobo
 * @desc The device follows the DownloadUrl from its sync. It authenticates
 *       with the token in the path, because a Kobo sends no session and no
 *       Authorization header of its own here.
 */
export async function GET(_request: Request, context: { params: Params }) {
  const { token, bookId } = await context.params

  const device = await getKoboDeviceByToken(token)
  if (!device)
    return NextResponse.json({ message: "Not found" }, { status: 404 })

  const book = await getBook(bookId as UUID, device.userId as UUID)
  if (!book?.ebook) {
    return NextResponse.json({ message: "Not found" }, { status: 404 })
  }

  // A device may only download what its shelf actually contains. Without this,
  // the token would be a key to the whole library rather than to her shelf.
  if (device.collectionUuid) {
    const onShelf = book.collections.some(
      (collection) => collection.uuid === device.collectionUuid,
    )
    if (!onShelf) {
      return NextResponse.json({ message: "Not found" }, { status: 404 })
    }
  }

  const filepath = book.ebook.filepath
  let file
  try {
    file = await open(filepath)
  } catch {
    // Same treatment as every other download path: record it rather than
    // leaving a book that silently fails on the device forever.
    void markFormatMissing(book.uuid, "ebook" as BookFormat)
    logger.error(`Kobo download: could not open ${filepath}`)
    return NextResponse.json({ message: "Not found" }, { status: 404 })
  }

  const stats = await file.stat()
  const stream = createReadStream("", { fd: file.fd, autoClose: true })
  stream.on("error", (e) => {
    logger.error(e)
  })

  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "application/epub+zip",
      "Content-Length": `${stats.size}`,
    },
  })
}
