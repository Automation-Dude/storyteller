import {
  getExtractedAudiobookCover,
  getExtractedEbookCover,
} from "@/assets/covers"
import { db } from "@/database/connection"
import { getCoverColors } from "@/images"
import { logger } from "@/logging"

export default async function migrate() {
  logger.info("Generating cover colors")

  const tables = (await db.introspection.getTables()).filter((table) =>
    ["ebook", "audiobook", "readaloud"].includes(table.name),
  )

  for (const table of tables) {
    if (table.columns.find((column) => column.name === "cover_colors")) {
      continue
    }

    await db.schema
      .alterTable(table.name)
      .addColumn("cover_colors", "text")
      .execute()
  }

  const books = await db.selectFrom("book").selectAll().execute()

  for (const book of books) {
    const [ebookCover, audiobookCover] = await Promise.all([
      getExtractedEbookCover(book),
      getExtractedAudiobookCover(book),
    ])

    if (ebookCover) {
      const colors = getCoverColors(ebookCover.data)
      if (colors) {
        const jsonColors = JSON.stringify(colors)
        await db
          .updateTable("ebook")
          .set({ coverColors: jsonColors })
          .where("bookUuid", "=", book.uuid)
          .execute()

        await db
          .updateTable("readaloud")
          .set({ coverColors: jsonColors })
          .where("bookUuid", "=", book.uuid)
          .execute()
      }
    }

    if (audiobookCover) {
      const colors = getCoverColors(audiobookCover.data)
      if (colors) {
        const jsonColors = JSON.stringify(colors)
        await db
          .updateTable("audiobook")
          .set({ coverColors: jsonColors })
          .where("bookUuid", "=", book.uuid)
          .execute()
      }
    }
  }
}
