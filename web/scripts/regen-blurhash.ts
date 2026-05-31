// just a dev tool to regenerate blurhashes for all books

import {
  getExtractedAudiobookCover,
  getExtractedEbookCover,
} from "@/assets/covers"
import { getBooks } from "@/database/books"
import { db } from "@/database/connection"
import { generateBlurhash } from "@/images"

async function regenBlurhash() {
  const books = await getBooks()

  for (const book of books) {
    const [ebookCover, audiobookCover] = await Promise.all([
      getExtractedEbookCover(book),
      getExtractedAudiobookCover(book),
    ])

    if (ebookCover) {
      const blurhash = await generateBlurhash(ebookCover.data, "ebook")
      if (blurhash) {
        await db
          .updateTable("ebook")
          .set({ coverBlurhash: blurhash })
          .where("bookUuid", "=", book.uuid)
          .execute()

        await db
          .updateTable("readaloud")
          .set({ coverBlurhash: blurhash })
          .where("bookUuid", "=", book.uuid)
          .execute()
      }
    }

    if (audiobookCover) {
      const blurhash = await generateBlurhash(audiobookCover.data, "audiobook")
      if (blurhash) {
        await db
          .updateTable("audiobook")
          .set({ coverBlurhash: blurhash })
          .where("bookUuid", "=", book.uuid)
          .execute()
      }
    }

    //   await touchBook(book.uuid)
  }
}

if (import.meta.main) {
  // console.log("regenerating blurhashes")
  await regenBlurhash()
}
