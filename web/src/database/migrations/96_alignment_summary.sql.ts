import { sql } from "kysely"

import { type Report, summarizeReport } from "@/database/alignmentReports"
import { db } from "@/database/connection"
import { logger } from "@/logging"

// the alignment_* columns are added by 96_alignment_summary.sql. here we backfill
// them from the latest existing alignment report per book (see summarizeReport).
export default async function migrate() {
  logger.info({ msg: "Backfilling alignment summaries onto books." })

  // newest first, so the first row seen per book is the latest report.
  const rows = await db
    .selectFrom("alignmentReport")
    .select(["uuid", "bookUuid", "report"])
    .where("bookUuid", "is not", null)
    .orderBy("createdAt", "desc")
    .execute()

  const seen = new Set<string>()
  let count = 0
  for (const row of rows) {
    if (!row.bookUuid || seen.has(row.bookUuid)) continue
    seen.add(row.bookUuid)

    const report: Report =
      typeof row.report === "string"
        ? (JSON.parse(row.report) as Report)
        : row.report
    const s = summarizeReport(report)

    await sql`
      UPDATE book SET
        alignment_grade = ${s.grade},
        alignment_score = ${s.score},
        alignment_chapters = ${s.chapters},
        alignment_missing_sentences = ${s.missingSentences},
        alignment_muted_chapters = ${s.mutedChapters},
        alignment_failed_chapters = ${s.failedChapters},
        alignment_unaligned_audio = ${s.unalignedAudio},
        alignment_report_uuid = ${row.uuid}
      WHERE uuid = ${row.bookUuid}
    `.execute(db)
    count++
  }

  logger.info({ msg: `Backfilled alignment summaries for ${count} books` })
}
