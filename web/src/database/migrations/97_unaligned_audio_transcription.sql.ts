import { readFile } from "node:fs/promises"

import {
  getTranscriptionFilename,
  getTranscriptionsFilepath,
} from "@/assets/paths"
import { type Report } from "@/database/alignmentReports"
import { type Book } from "@/database/books"
import { db } from "@/database/connection"
import { logger } from "@/logging"

// older reports (and the migration-95 backfill) have no transcription on their
// unaligned audio files. fill it in from the on-disk transcription where it is
// still available, so "this audio didn't align at all" is debuggable. purely
// best-effort: a missing transcription is skipped silently.
export default async function migrate() {
  const rows = await db
    .selectFrom("alignmentReport")
    .innerJoin("book", "book.uuid", "alignmentReport.bookUuid")
    .select([
      "alignmentReport.uuid as reportUuid",
      "alignmentReport.report as report",
      "book.uuid as uuid",
      "book.assetDir as assetDir",
      "book.title as title",
    ])
    .execute()

  let enriched = 0
  for (const row of rows) {
    const report: Report =
      typeof row.report === "string"
        ? (JSON.parse(row.report) as Report)
        : row.report
    if (report.unalignedAudioFiles.length === 0) continue

    let changed = false
    for (const uaf of report.unalignedAudioFiles) {
      if (uaf.transcription) continue
      try {
        const text = await readFile(
          getTranscriptionsFilepath(
            row as unknown as Book,
            getTranscriptionFilename(uaf.filepath),
          ),
          { encoding: "utf-8" },
        )
        const parsed = JSON.parse(text) as { transcript?: string }
        const transcript = parsed.transcript?.trim()
        if (transcript) {
          uaf.transcription = { text: transcript.slice(0, 2000) }
          changed = true
        }
      } catch {
        // transcription is gone; nothing we can do.
      }
    }

    if (changed) {
      await db
        .updateTable("alignmentReport")
        .set({ report: JSON.stringify(report) })
        .where("uuid", "=", row.reportUuid)
        .execute()
      enriched++
    }
  }

  logger.info({
    msg: `Enriched unaligned audio transcription for ${enriched} reports`,
  })
}
