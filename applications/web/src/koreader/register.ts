import { after } from "next/server"

import { type BookWithRelations } from "@/database/books"
import { getSettings } from "@/database/settings"
import { upsertKoreaderDocument } from "@/koreader/database"
import { partialMd5 } from "@/koreader/hash"
import { logger } from "@/logging"

/**
 * KOReader hashes the exact bytes sitting on the device, so the only reliable
 * way to map a digest back to a book is to hash the file we actually served.
 * Registering at download time also means a device that later reports that
 * digest resolves without the user configuring anything.
 *
 * Runs after the response so a download is never delayed by hashing.
 */
export function registerServedDocument(
  book: BookWithRelations,
  format: string,
  filepath: string,
) {
  if (format !== "ebook" && format !== "readaloud") return

  after(async () => {
    try {
      const settings = await getSettings()
      if (!settings.koreaderSyncEnabled) return

      const document = await partialMd5(filepath)

      await upsertKoreaderDocument(
        document,
        book.uuid,
        format === "ebook" ? ((book.ebook?.uuid ?? null)) : null,
        format === "readaloud"
          ? ((book.readaloud?.uuid ?? null))
          : null,
      )

      logger.debug(
        `Registered KOReader document ${document} for book ${book.uuid}`,
      )
    } catch (e) {
      logger.warn(`Could not register a KOReader document digest: ${String(e)}`)
    }
  })
}
