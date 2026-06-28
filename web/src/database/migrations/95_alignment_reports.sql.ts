import { readFile } from "node:fs/promises"

import { sql } from "kysely"

import { getAlignmentReportFilepath } from "@/assets/paths"
import { type Report, createAlignmentReport } from "@/database/alignmentReports"
import { type Book } from "@/database/books"
import { db } from "@/database/connection"
import { logger } from "@/logging"

export default async function migrate() {
  await db.transaction().execute(async (trx) => {
    await sql`
      CREATE TABLE IF NOT EXISTS alignment_report (
        uuid TEXT PRIMARY KEY NOT NULL DEFAULT (uuid ()),
        job_uuid TEXT REFERENCES job (uuid) ON DELETE SET NULL,
        book_uuid TEXT REFERENCES book (uuid) ON DELETE CASCADE,
        report TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `.execute(trx)

    await sql`
      CREATE INDEX IF NOT EXISTS idx_alignment_report_job ON alignment_report (job_uuid)
    `.execute(trx)

    await sql`
      CREATE INDEX IF NOT EXISTS idx_alignment_report_book ON alignment_report (book_uuid)
    `.execute(trx)
  })

  logger.info({
    msg: "Backfilling alignment reports. This could take a second.",
  })

  // now find all existing books, find their reports, and insert them into the table
  const books = await db
    .selectFrom("book")
    .select(["book.uuid", "book.assetDir", "book.title"])
    .innerJoin("readaloud", "readaloud.bookUuid", "book.uuid")
    .leftJoin("alignmentReport", "alignmentReport.bookUuid", "book.uuid")
    .where("readaloud.missing", "=", false)
    .where("readaloud.status", "=", "ALIGNED")
    .where("alignmentReport.bookUuid", "is", null)
    .execute()

  logger.info({ msg: `Found ${books.length} books to backfill` })
  for (const book of books) {
    let report: Report | null = null
    try {
      const reportText = await readFile(
        getAlignmentReportFilepath(book as Book),
        { encoding: "utf-8" },
      )

      report = JSON.parse(reportText) as Report
    } catch (error) {
      logger.warn({
        msg: `Failed to read alignment report for book ${book.title}. This is expected and not an error.`,
        err: error,
      })
      continue
    }

    try {
      await createAlignmentReport({
        bookUuid: book.uuid,
        report: report,
        jobUuid: null,
      })
      logger.info({ msg: `Backfilled alignment report for book ${book.title}` })
    } catch (error) {
      logger.error({
        msg: `Failed to create alignment report for book ${book.title}`,
        err: error,
      })
    }
  }
}
