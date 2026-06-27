import { type Selectable } from "kysely"

import { type Report } from "@storyteller-platform/align"

import type { UUID } from "@/uuid"

import { db } from "./connection"
import { type DB } from "./schema"

export type { Report }

type AlignmentReportRow = Selectable<DB["alignmentReport"]>

export type AlignmentReport = Omit<
  AlignmentReportRow,
  "uuid" | "jobUuid" | "bookUuid" | "report"
> & {
  uuid: UUID
  jobUuid: UUID | null
  bookUuid: UUID | null
  report: Report
}

function parseAlignmentReport(row: AlignmentReportRow): AlignmentReport {
  return {
    ...row,
    uuid: row.uuid as UUID,
    jobUuid: (row.jobUuid as UUID | null) ?? null,
    bookUuid: (row.bookUuid as UUID | null) ?? null,
    report: row.report,
  }
}

export async function createAlignmentReport(input: {
  jobUuid: UUID | null
  bookUuid: UUID | null
  report: Report
}): Promise<AlignmentReport> {
  const row = await db
    .insertInto("alignmentReport")
    .values({
      jobUuid: input.jobUuid,
      bookUuid: input.bookUuid,
      report: JSON.stringify(input.report),
    })
    .returningAll()
    .executeTakeFirstOrThrow()
  return parseAlignmentReport(row)
}

// latest report for a job (a re-run could produce more than one).
export async function getAlignmentReportForJob(
  jobUuid: UUID,
): Promise<AlignmentReport | null> {
  const row = await db
    .selectFrom("alignmentReport")
    .selectAll()
    .where("jobUuid", "=", jobUuid)
    .orderBy("createdAt", "desc")
    .limit(1)
    .executeTakeFirst()

  return row ?? null
}
