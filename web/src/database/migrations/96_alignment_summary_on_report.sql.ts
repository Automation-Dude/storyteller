import { sql } from "kysely"

import {
  type Report,
  summarizeReport,
} from "@/database/alignmentReports"
import { db } from "@/database/connection"
import { logger } from "@/logging"

const REPORT_SUMMARY_COLUMNS: Array<[name: string, type: string]> = [
  ["grade", "TEXT"],
  ["score", "REAL"],
  ["chapters", "INTEGER"],
  ["missing_sentences", "INTEGER"],
  ["muted_chapters", "INTEGER"],
  ["failed_chapters", "INTEGER"],
  ["unaligned_audio", "INTEGER"],
]

const BOOK_ALIGNMENT_COLUMNS = [
  "alignment_grade",
  "alignment_score",
  "alignment_chapters",
  "alignment_missing_sentences",
  "alignment_muted_chapters",
  "alignment_failed_chapters",
  "alignment_unaligned_audio",
  "alignment_report_uuid",
]

export default async function migrate() {
  await addColumnsToReport()
  await backfillSummaries()
  await dropColumnsFromBook()
}

async function addColumnsToReport() {
  const columns = await sql<{ name: string }>`
    PRAGMA table_info (alignment_report)
  `.execute(db)
  const existing = new Set(columns.rows.map((r) => r.name))

  for (const [name, type] of REPORT_SUMMARY_COLUMNS) {
    if (existing.has(name)) continue

    await sql`
      ALTER TABLE alignment_report ADD COLUMN ${sql.raw(name)} ${sql.raw(type)}
    `.execute(db)
  }
}

async function backfillSummaries() {
  const rows = await db
    .selectFrom("alignmentReport")
    .select(["uuid", "report"])
    .where("grade", "is", null)
    .execute()

  if (rows.length === 0) return

  logger.info({
    msg: `Backfilling alignment summaries for ${rows.length} reports`,
  })

  let count = 0
  for (const row of rows) {
    const report: Report =
      typeof row.report === "string"
        ? (JSON.parse(row.report) as Report)
        : row.report
    const s = summarizeReport(report)

    await sql`
      UPDATE alignment_report SET
        grade = ${s.grade},
        score = ${s.score},
        chapters = ${s.chapters},
        missing_sentences = ${s.missingSentences},
        muted_chapters = ${s.mutedChapters},
        failed_chapters = ${s.failedChapters},
        unaligned_audio = ${s.unalignedAudio}
      WHERE uuid = ${row.uuid}
    `.execute(db)
    count++
  }

  logger.info({ msg: `Backfilled alignment summaries for ${count} reports` })
}

async function dropColumnsFromBook() {
  const columns = await sql<{ name: string }>`
    PRAGMA table_info (book)
  `.execute(db)
  const existing = new Set(columns.rows.map((r) => r.name))

  for (const name of BOOK_ALIGNMENT_COLUMNS) {
    if (!existing.has(name)) continue

    await sql`
      ALTER TABLE book DROP COLUMN ${sql.raw(name)}
    `.execute(db)
  }
}
