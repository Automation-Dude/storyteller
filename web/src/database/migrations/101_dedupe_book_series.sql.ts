import { sql } from "kysely"

import { db } from "@/database/connection"

// a book could previously be added to the same series more than once. dedupe
// existing rows (keep the earliest by rowid) then add a unique index so it can't
// happen again. dedupe must run before the index or the index creation fails.
export default async function migrate() {
  await db.transaction().execute(async (trx) => {
    await sql`
      DELETE FROM book_to_series
      WHERE rowid NOT IN (
        SELECT MIN(rowid)
        FROM book_to_series
        GROUP BY book_uuid, series_uuid
      )
    `.execute(trx)

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_book_to_series_unique
      ON book_to_series (book_uuid, series_uuid)
    `.execute(trx)
  })
}
