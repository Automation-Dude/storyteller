import { booksQuery } from "@/database/books"
import { type UUID } from "@/uuid"

import {
  type KoboDeviceRecord,
  getSyncedBookUuids,
  markBooksSynced,
} from "./devices"
import { type KoboDownloadUrl, buildNewEntitlement } from "./metadata"

/**
 * The Kobo sync protocol is incremental: the device sends the token from its
 * last sync and expects only what has changed. Sending the whole shelf every
 * time would work once and then re-download her library on every sync, so what
 * has already been sent is tracked per device.
 *
 * A sync is also capped: Kobo processes a bounded batch and comes back for
 * more, signalled by a continuation header. Handing it everything at once is
 * how a large library ends up timing out mid-sync.
 */

/** Kobo's own batch size. Larger and the device starts dropping the response. */
export const SYNC_ITEM_LIMIT = 100

export type SyncResult = {
  /** The JSON array the device consumes. */
  items: Record<string, unknown>[]
  /** True when more remain; the device is told to sync again immediately. */
  hasMore: boolean
  /** The books included, so they can be marked sent once the response is out. */
  bookUuids: UUID[]
}

/**
 * Only formats a Kobo can actually open. An audiobook or a readaloud on her
 * shelf would otherwise appear as a book that fails to download.
 */
function downloadUrlsFor(
  book: { uuid: string; ebook: { fileSize: number | null } | null },
  baseUrl: string,
): KoboDownloadUrl[] {
  if (!book.ebook) return []
  return [
    {
      Format: "EPUB3",
      Size: book.ebook.fileSize ?? 0,
      Url: `${baseUrl}/download/${book.uuid}`,
      Platform: "Generic",
    },
  ]
}

/**
 * Build one page of a device's sync.
 *
 * `collectionUuid` on the device is the shelf: with it set, she sees exactly
 * the books put on that shelf, which is the whole point of curating for a
 * reader rather than handing over the entire library.
 */
export async function buildSync(args: {
  device: KoboDeviceRecord
  /** Absolute base for download links, e.g. https://host/kobo/<token>. */
  baseUrl: string
}): Promise<SyncResult> {
  const { device, baseUrl } = args

  let query = booksQuery(device.userId as UUID)
  // Narrow outside the closure: inside it, the field is still string | null.
  const shelf = device.collectionUuid
  if (shelf) {
    query = query.where((eb) =>
      eb.exists(
        eb
          .selectFrom("bookToCollection")
          .select("bookToCollection.uuid")
          .whereRef("bookToCollection.bookUuid", "=", "book.uuid")
          .where("bookToCollection.collectionUuid", "=", shelf),
      ),
    )
  }

  const books = await query.orderBy("book.createdAt", "asc").execute()
  const alreadySent = await getSyncedBookUuids(device.uuid)

  // Only books she can actually read on a Kobo, and only ones not yet sent.
  const pending = books.filter(
    (book) => book.ebook && !book.ebook.missing && !alreadySent.has(book.uuid),
  )

  const batch = pending.slice(0, SYNC_ITEM_LIMIT)
  const now = new Date().toISOString()

  const items = batch.map((book) =>
    buildNewEntitlement(book, downloadUrlsFor(book, baseUrl), now),
  )

  return {
    items,
    hasMore: pending.length > batch.length,
    bookUuids: batch.map((book) => book.uuid),
  }
}

/** Record what went out, once the response is committed. */
export async function commitSync(
  device: KoboDeviceRecord,
  bookUuids: UUID[],
): Promise<void> {
  await markBooksSynced(device.uuid, bookUuids)
}
