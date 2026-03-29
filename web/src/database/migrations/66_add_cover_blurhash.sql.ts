import {
  getExtractedAudiobookCover,
  getExtractedEbookCover,
} from "@/assets/covers"
import { db } from "@/database/connection"
import { generateBlurhash } from "@/images"
import { logger } from "@/logging"

export default async function migrate() {
  logger.info("Generating cover blurhashes")

  const books = await db.selectFrom("book").selectAll().execute()

  for (const book of books) {
    const [ebookCover, audiobookCover] = await Promise.all([
      getExtractedEbookCover(book),
      getExtractedAudiobookCover(book),
    ])

    if (ebookCover) {
      const blurhash = await generateBlurhash(ebookCover.data)
      if (blurhash) {
        await db
          .updateTable("ebook")
          .set({ coverBlurhash: blurhash })
          .where("bookUuid", "=", book.uuid)
          .execute()
      }
    }

    if (audiobookCover) {
      const blurhash = await generateBlurhash(audiobookCover.data)
      if (blurhash) {
        await db
          .updateTable("audiobook")
          .set({ coverBlurhash: blurhash })
          .where("bookUuid", "=", book.uuid)
          .execute()
      }
    }

    logger.info(`Generated blurhash for ${book.title}`)
  }
}
