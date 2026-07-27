import { booksQuery } from "@/database/books"
import { type UUID } from "@/uuid"

import {
  type KoboDeviceRecord,
  forgetSyncedBooks,
  getSyncedBookUuids,
  markBooksSynced,
} from "./devices"
import {
  type KoboDownloadUrl,
  buildNewEntitlement,
  buildRemovedEntitlement,
} from "./metadata"

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
  /** Books taken back, so the device can be sent them again if they return. */
  removedUuids: string[]
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
      // We ask for the device's own kepub reader, which is the only one that
      // remembers the sentence she stopped on. The download converts the book
      // when it can and serves the plain EPUB when it cannot; a Kobo reads
      // either under this format, losing only the finer position.
      Format: "KEPUB",
      // The size before conversion, as the converted file does not exist yet.
      // The device reads the real length off the download itself.
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

  // A device that was given a shelf but no longer has one gets nothing, not
  // everything. The alternative is that losing a shelf quietly hands a reader
  // the entire library, which is the wrong way for this to fail.
  if (!device.wholeLibrary && !device.collectionUuid) {
    const alreadySentAll = await getSyncedBookUuids(device.uuid)
    const now = new Date().toISOString()
    const removals = [...alreadySentAll].slice(0, SYNC_ITEM_LIMIT)
    return {
      items: removals.map((uuid) => buildRemovedEntitlement(uuid, now)),
      hasMore: alreadySentAll.size > removals.length,
      bookUuids: [],
      removedUuids: removals,
    }
  }

  let query = booksQuery(device.userId as UUID)
  // Narrow outside the closure: inside it, the field is still string | null.
  const shelf = device.wholeLibrary ? null : device.collectionUuid
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

  const onShelf = await query.orderBy("book.createdAt", "asc").execute()
  const alreadySent = await getSyncedBookUuids(device.uuid)
  const onShelfUuids = new Set<string>(onShelf.map((book) => book.uuid))

  // Removal means the book left the shelf, and nothing else.
  //
  // Deliberately not "we cannot serve it right now": a format is marked
  // missing lazily, the first time a download fails, so keying removal off
  // that would let one bad moment on the server delete a book she is halfway
  // through. A book that is on the shelf but unreadable is left alone.
  const removed = [...alreadySent].filter((uuid) => !onShelfUuids.has(uuid))

  // Only send what a Kobo can actually open and what is really on disk: a book
  // whose file is gone would appear on the device and fail to download.
  const pending = onShelf.filter(
    (book) => book.ebook && !book.ebook.missing && !alreadySent.has(book.uuid),
  )

  const now = new Date().toISOString()

  // Removals are cheap and go first: the device should not be told to fetch
  // new books while still holding ones it should not have.
  const removals = removed.slice(0, SYNC_ITEM_LIMIT)
  const room = SYNC_ITEM_LIMIT - removals.length
  const batch = pending.slice(0, Math.max(room, 0))

  const items = [
    ...removals.map((uuid) => buildRemovedEntitlement(uuid, now)),
    ...batch.map((book) =>
      buildNewEntitlement(book, downloadUrlsFor(book, baseUrl), now),
    ),
  ]

  return {
    items,
    hasMore: removed.length > removals.length || pending.length > batch.length,
    bookUuids: batch.map((book) => book.uuid),
    removedUuids: removals,
  }
}

/** Record what went out, once the response is committed. */
export async function commitSync(
  device: KoboDeviceRecord,
  result: Pick<SyncResult, "bookUuids" | "removedUuids">,
): Promise<void> {
  await markBooksSynced(device.uuid, result.bookUuids)
  // Forget removals, so putting a book back on the shelf sends it again.
  await forgetSyncedBooks(device.uuid, result.removedUuids)
}
