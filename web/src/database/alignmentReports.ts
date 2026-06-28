import { type Selectable } from "kysely"

import { type Report } from "@storyteller-platform/align"

import { type AlignmentFacets } from "@/alignmentReportView"
import type { UUID } from "@/uuid"

import { db } from "./connection"
import { type DB } from "./schema"

export type { Report }

type ChapterReport = Report["chapters"][number]

export type AlignmentGrade = "A+" | "A" | "A-" | "B" | "B-" | "C" | "D" | "F"

export interface AlignmentSummary {
  grade: AlignmentGrade
  // integer percent 0..100, null when no chapter has sentence-count data.
  score: number | null
  chapters: number
  missingSentences: number
  mutedChapters: number
  failedChapters: number
  unalignedAudio: number
}

// derive a compact quality summary from a raw report. this is a direct port of
// the standalone book-report analyzer's grading, kept pure so it can run at
// report-write time and in the backfill migration.
export function summarizeReport(report: Report): AlignmentSummary {
  const chapters = report.chapters

  let totalSents = 0
  let totalAligned = 0
  let missingSentences = 0
  for (const ch of chapters) {
    const total = ch.chapterSentenceCount || 0
    if (total > 0) {
      const al = ch.alignedSentenceCount
      totalSents += total
      totalAligned += al
      missingSentences += Math.max(total - al, 0)
    }
  }
  const score =
    totalSents > 0 ? Math.round((totalAligned / totalSents) * 100) : null

  // muted: chapters with no audio and more than two sentences (short stubs are
  // almost always erroneous and excluded, matching the analyzer).
  const mutedChapters = chapters.filter(
    (ch) => ch.audioFiles.length === 0 && (ch.chapterSentenceCount || 0) > 2,
  ).length

  // failed: chapters the aligner could not place at all -- not-found unaligned
  // chapters plus chapters with sentences but zero matches.
  const notFound = report.unalignedChapters.filter(
    (c) => c.reason === "not-found",
  ).length
  const noMatch = chapters.filter(
    (ch) => (ch.chapterSentenceCount || 0) > 0 && ch.alignedSentenceCount === 0,
  ).length

  return {
    grade: computeGrade(score, chapters),
    score,
    chapters: chapters.length,
    missingSentences,
    mutedChapters,
    failedChapters: notFound + noMatch,
    unalignedAudio: report.unalignedAudioFiles.length,
  }
}

function computeGrade(
  score: number | null,
  chapters: ChapterReport[],
): AlignmentGrade {
  if (chapters.length === 0) return "F"
  if (score == null || score < 80) return "F"
  if (score < 90) return "D"
  if (score < 95) return "C"
  if (score >= 99) return "A+"

  const sig = chapters.filter((ch) => {
    const cnt = ch.chapterSentenceCount || 0
    if (cnt === 0) return false
    const al = ch.alignedSentenceCount
    return cnt - al > 5 && (al / cnt) * 100 < 95
  }).length
  const severe = chapters.filter((ch) => {
    const cnt = ch.chapterSentenceCount || 0
    if (cnt === 0) return false
    const al = ch.alignedSentenceCount
    return cnt - al > 10 && (al / cnt) * 100 < 90
  }).length

  if (score >= 97) return sig >= 3 ? "A-" : "A"
  return severe >= 3 ? "B-" : "B"
}

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
  return { ...row }
}

export async function createAlignmentReport(input: {
  jobUuid: UUID | null
  bookUuid: UUID | null
  report: Report
}): Promise<AlignmentReport> {
  const row = await db.transaction().execute(async (trx) => {
    const inserted = await trx
      .insertInto("alignmentReport")
      .values({
        jobUuid: input.jobUuid,
        bookUuid: input.bookUuid,
        report: JSON.stringify(input.report),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    // keep the denormalized quality columns on book current (latest wins).
    if (input.bookUuid) {
      const s = summarizeReport(input.report)
      await trx
        .updateTable("book")
        .set({
          alignmentGrade: s.grade,
          alignmentScore: s.score,
          alignmentChapters: s.chapters,
          alignmentMissingSentences: s.missingSentences,
          alignmentMutedChapters: s.mutedChapters,
          alignmentFailedChapters: s.failedChapters,
          alignmentUnalignedAudio: s.unalignedAudio,
          alignmentReportUuid: inserted.uuid,
        })
        .where("uuid", "=", input.bookUuid)
        .execute()
    }

    return inserted
  })
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

// latest report for a book, regardless of which job produced it (covers
// backfilled reports that have no job).
export async function getAlignmentReportForBook(
  bookUuid: UUID,
): Promise<AlignmentReport | null> {
  const row = await db
    .selectFrom("alignmentReport")
    .selectAll()
    .where("bookUuid", "=", bookUuid)
    .orderBy("createdAt", "desc")
    .limit(1)
    .executeTakeFirst()

  return row ?? null
}

// counts that back the quality view's grade chips and muted filter, computed in
// sql so the page never loads the whole catalog to tally facets.
export async function getAlignmentFacets(): Promise<AlignmentFacets> {
  const gradeRows = await db
    .selectFrom("book")
    .select(["book.alignmentGrade as grade"])
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("book.alignmentGrade", "is not", null)
    .groupBy("book.alignmentGrade")
    .execute()

  const mutedRow = await db
    .selectFrom("book")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("book.alignmentGrade", "is not", null)
    .where("book.alignmentMutedChapters", ">", 0)
    .executeTakeFirst()

  const grades: Record<string, number> = {}
  let total = 0
  for (const row of gradeRows) {
    if (!row.grade) continue
    grades[row.grade] = row.count
    total += row.count
  }

  return { grades, total, muted: mutedRow?.count ?? 0 }
}
