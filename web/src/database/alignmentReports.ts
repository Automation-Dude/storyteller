import { type Selectable, sql } from "kysely"

import { type Report } from "@storyteller-platform/align"

import { type AlignmentFacets } from "@/alignmentReportView"
import { type AlignmentGrade } from "@/shelves"
import type { UUID } from "@/uuid"

import { db } from "./connection"
import { type DB } from "./schema"

export type { Report }

type ChapterReport = Report["chapters"][number]

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

// per-chapter mark. markedOk = "this chapter is fine as-is" (intended mismatch);
// excludeFromScore = leave the chapter out of the score/grade math only.
export interface AlignmentChapterOverride {
  excludeFromScore?: boolean
  markedOk?: boolean
}

// user edits that adjust how a report is scored/graded. keyed by chapter href /
// audio filepath. stored as json on the report row; lost on re-align (a re-run
// writes a fresh report row).
export interface AlignmentOverrides {
  chapters?: Record<string, AlignmentChapterOverride>
  // unaligned chapters deliberately left unmatched (not a failure).
  unalignedChapters?: Record<string, { intended?: boolean }>
  // audio clips deliberately not placed (not counted as unaligned).
  audioFiles?: Record<string, { excluded?: boolean }>
}

// a chapter marked ok or excluded is dropped from the score / grade / counts.
function chapterExcluded(href: string, overrides?: AlignmentOverrides): boolean {
  const o = overrides?.chapters?.[href]
  return !!(o?.excludeFromScore || o?.markedOk)
}

export function summarizeReport(
  report: Omit<
    Report,
    "unalignedChapters" | "audioFiles" | "unalignedAudioFiles"
  > &
    Partial<
      Pick<Report, "unalignedChapters" | "audioFiles" | "unalignedAudioFiles">
    >,
  overrides?: AlignmentOverrides | null,
): AlignmentSummary {
  const chapters = report.chapters
  const scored = chapters.filter(
    (ch) => !chapterExcluded(ch.href, overrides ?? undefined),
  )

  let totalSents = 0
  let totalAligned = 0
  let missingSentences = 0
  for (const ch of scored) {
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
  // almost always erroneous and excluded, matching the analyzer). chapters the
  // user marked ok are no longer flagged.
  const mutedChapters = chapters.filter(
    (ch) =>
      !overrides?.chapters?.[ch.href]?.markedOk &&
      (ch.audioFiles ?? []).length === 0 &&
      (ch.chapterSentenceCount || 0) > 2,
  ).length

  // failed: chapters the aligner could not place at all -- not-found unaligned
  // chapters plus chapters with sentences but zero matches. chapters/unaligned
  // chapters the user marked ok / intended drop out.
  // older report files may not have these arrays at all
  const notFound = (report.unalignedChapters ?? []).filter(
    (c) =>
      c.reason === "not-found" &&
      !overrides?.unalignedChapters?.[c.href]?.intended,
  ).length
  const noMatch = chapters.filter(
    (ch) =>
      !overrides?.chapters?.[ch.href]?.markedOk &&
      (ch.chapterSentenceCount || 0) > 0 &&
      ch.alignedSentenceCount === 0,
  ).length

  const unalignedAudio = (report.unalignedAudioFiles ?? []).filter(
    (uaf) => !overrides?.audioFiles?.[uaf.filepath]?.excluded,
  ).length

  return {
    grade: computeGrade(score, scored),
    score,
    chapters: chapters.length,
    missingSentences,
    mutedChapters,
    failedChapters: notFound + noMatch,
    unalignedAudio,
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
  const s = summarizeReport(input.report)

  const row = await db
    .insertInto("alignmentReport")
    .values({
      jobUuid: input.jobUuid,
      bookUuid: input.bookUuid,
      report: JSON.stringify(input.report),
      grade: s.grade,
      score: s.score,
      chapters: s.chapters,
      missingSentences: s.missingSentences,
      mutedChapters: s.mutedChapters,
      failedChapters: s.failedChapters,
      unalignedAudio: s.unalignedAudio,
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

// replace a report's overrides and recompute its persisted summary columns, so
// the edited grade shows up everywhere it is cached (quality list, facets,
// sort, the queue badge) without re-parsing the raw report elsewhere.
export async function updateAlignmentOverrides(
  reportUuid: UUID,
  overrides: AlignmentOverrides,
): Promise<AlignmentReport> {
  const existing = await db
    .selectFrom("alignmentReport")
    .selectAll()
    .where("uuid", "=", reportUuid)
    .executeTakeFirstOrThrow()

  const s = summarizeReport(existing.report, overrides)

  const row = await db
    .updateTable("alignmentReport")
    .set({
      overrides: JSON.stringify(overrides),
      grade: s.grade,
      score: s.score,
      chapters: s.chapters,
      missingSentences: s.missingSentences,
      mutedChapters: s.mutedChapters,
      failedChapters: s.failedChapters,
      unalignedAudio: s.unalignedAudio,
    })
    .where("uuid", "=", reportUuid)
    .returningAll()
    .executeTakeFirstOrThrow()

  return parseAlignmentReport(row)
}

// counts that back the quality view's grade chips and muted filter, computed in
// sql so the page never loads the whole catalog to tally facets. uses a
// row_number window to pick the latest report per book.
export async function getAlignmentFacets(): Promise<AlignmentFacets> {
  const gradeResult = await sql<{ grade: string; count: number }>`
    select grade, count(*) as count
    from (
      select grade,
             row_number() over (partition by book_uuid order by created_at desc) as rn
      from alignment_report
      where grade is not null
    )
    where rn = 1
    group by grade
  `.execute(db)

  const mutedResult = await sql<{ count: number }>`
    select count(*) as count
    from (
      select muted_chapters,
             row_number() over (partition by book_uuid order by created_at desc) as rn
      from alignment_report
      where grade is not null
    )
    where rn = 1 and muted_chapters > 0
  `.execute(db)

  const grades: Record<string, number> = {}
  let total = 0
  for (const row of gradeResult.rows) {
    if (!row.grade) continue
    grades[row.grade] = row.count
    total += row.count
  }

  return { grades, total, muted: mutedResult.rows[0]?.count ?? 0 }
}
