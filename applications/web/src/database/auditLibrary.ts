import { readFile } from "node:fs/promises"

import { getExtractedCover } from "@/assets/covers"
import { imageStats } from "@/images"
import { logger } from "@/logging"
import { authorNameIsBad } from "@/metadata/localSignals"
import { type UUID } from "@/uuid"


import { getBooks } from "./books"

/**
 * Audit the library the way an e-reader shelf sees it.
 *
 * Every judgement here comes from the app's own code, not a re-derivation of
 * it: metadata from {@link getBooks} (the same query the reader and the Kobo
 * sync use, so authors are the `aut` creators, narrators the `nrt` ones), and
 * covers from {@link getExtractedCover} (the exact function the Kobo cover
 * route calls). An earlier hand-rolled SQL-and-shell version mis-parsed its
 * own output and reported wrong counts; this exists so the numbers are the
 * ones the running app would produce.
 *
 * Covers need the asset files on disk. When this runs where they live it asks
 * getExtractedCover directly. When it runs off a copied database with no
 * assets (COVERS_PRESENT_FILE set), it reads a list of the book directories
 * that hold a cover image, gathered from those same directories on the server.
 * Because every book has an assetDir (verified), that directory name is the
 * exact path getExtractedCover would look in, so the two agree.
 */

/** The problems the audit reports, in the order it lists them. */
export const AUDIT_ISSUES = [
  "NO-COVER",
  "BLANK-COVER",
  "TINY-COVER",
  "NO-AUTHOR",
  "NO-LANG",
  "NO-DESC",
  "BAD-TITLE",
  "BAD-AUTHOR",
  "NO-SERIES",
] as const

export type AuditIssue = (typeof AUDIT_ISSUES)[number]

export type AuditBook = {
  uuid: UUID
  title: string
  authors: string[]
  issues: AuditIssue[]
}

export type LibraryAudit = {
  total: number
  flagged: number
  counts: Record<AuditIssue, number>
  books: AuditBook[]
}

// A cover this near a solid colour is blank in all but name; a cover this small
// is a thumbnail, not artwork. Tuned against the actual library (e.g. Wicked at
// entropy 0.31, Watership Down at 38x54).
const BLANK_COVER_ENTROPY = 1.5
const TINY_COVER_PX = 200

const PLACEHOLDER_TITLES = new Set(["unknown", "untitled", "unknown title"])

/**
 * Signals that a title is really an ingestion artifact, not a book name.
 *
 * These are tuned against the actual library: leading track/disc numbers
 * ("02 - Dune - ..."), catalogue codes ("DP19 - Treasure of Khan"), an author
 * dumped before the title ("Hobb - Liveship Traders - ..."), file and format
 * leftovers ("..._mp3", "epub2"), edition noise ("(Unabridged)"), and the
 * worst case, a whole URL or blurb where the title should be. Bare all-caps or
 * a stray underscore are deliberately not enough on their own, so a real title
 * like "SHIFT" is left alone.
 */
const BAD_TITLE_PATTERNS: RegExp[] = [
  /^\d+\s*[-_.]\s*\S/, // leading track/disc number: "02 - ...", "18 - ..."
  /^(cd|disc|disk)\s*\d+/i, // "CD1 - ...", "Disc 01"
  /\b(cd|disc|disk|pt|part|track)\s*\d+\b/i, // "(Disc 01)", "Part1"
  /\b[A-Z]{1,3}\d{2}\b[\s-]/, // catalogue code prefix: "DP19 -", "D01-"
  /^[A-Z][a-z]+\s+-\s+\S/, // author dumped first: "Hobb - ...", "Ludlum Robert - "
  /_\w|\w_/, // internal underscores: "_mp3", "Inn_Volume"
  /\bepub\d?\b|\.mp3\b|\.m4b\b|\bmp3\d*\b/i, // format leftovers
  /https?:\/\/|\|adbl\||media-amazon/i, // a URL or store blurb as the title
  /\((un)?abridged\)|\(full[- ]cast/i, // edition noise in place of a title
]

export function titleIsBad(title: string | null): boolean {
  const t = (title ?? "").trim()
  if (!t) return true
  if (PLACEHOLDER_TITLES.has(t.toLowerCase())) return true
  return BAD_TITLE_PATTERNS.some((re) => re.test(t))
}

async function loadCoverSet(path: string): Promise<Set<string>> {
  const text = await readFile(path, "utf-8")
  return new Set(
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  )
}

type AuditBookRow = Awaited<ReturnType<typeof getBooks>>[number]

/**
 * Cover problems for a book, checking ebook then audiobook, so a book with a
 * cover in either place is never called blank.
 *
 * Off-box (COVERS_PRESENT_FILE) we only know presence, not quality. In the
 * real environment we read the same cover the app serves and measure it.
 */
type CoverCacheEntry = { updatedAt: string; issues: AuditIssue[] }

declare global {
  // eslint-disable-next-line no-var
  var _auditCoverCache: Map<UUID, CoverCacheEntry> | undefined
}

function coverCache(): Map<UUID, CoverCacheEntry> {
  globalThis._auditCoverCache ??= new Map()
  return globalThis._auditCoverCache
}

/**
 * Forget a book's cached cover verdict. Called when something changes a cover
 * without touching the book row (installing a cover during a repair), which
 * the updatedAt key cannot see.
 */
export function invalidateAuditCover(bookUuid: UUID): void {
  coverCache().delete(bookUuid)
}

async function coverIssuesFor(
  book: AuditBookRow,
  coverSet: Set<string> | null,
): Promise<AuditIssue[]> {
  if (coverSet) {
    return book.assetDir && coverSet.has(book.assetDir) ? [] : ["NO-COVER"]
  }
  // Reading and measuring a cover is the audit's entire cost; a book that has
  // not changed since the last pass keeps its verdict, which turns a full
  // rescan from tens of minutes into seconds.
  const cached = coverCache().get(book.uuid)
  if (cached && cached.updatedAt === book.updatedAt) {
    return cached.issues
  }
  const cover =
    (await getExtractedCover(book, "ebook")) ??
    (await getExtractedCover(book, "audiobook"))
  let issues: AuditIssue[]
  if (!cover) {
    issues = ["NO-COVER"]
  } else {
    try {
      const { width, height, entropy } = await imageStats(cover.data)
      issues = []
      if (entropy < BLANK_COVER_ENTROPY) issues.push("BLANK-COVER")
      if (Math.min(width, height) < TINY_COVER_PX) issues.push("TINY-COVER")
    } catch {
      // Present but unreadable by sharp: it is still a cover, so do not call
      // it blank on the strength of not being able to measure it.
      issues = []
    }
  }
  coverCache().set(book.uuid, { updatedAt: book.updatedAt, issues })
  return issues
}

export async function computeBookIssues(
  book: AuditBookRow,
  coverSet: Set<string> | null,
): Promise<AuditIssue[]> {
  const issues: AuditIssue[] = [...(await coverIssuesFor(book, coverSet))]
  if (book.authors.length === 0) issues.push("NO-AUTHOR")
  if (!book.language || !book.language.trim()) issues.push("NO-LANG")
  if (!book.description || !book.description.trim()) issues.push("NO-DESC")
  if (titleIsBad(book.title)) issues.push("BAD-TITLE")
  if (book.authors.some((author) => authorNameIsBad(author.name)))
    issues.push("BAD-AUTHOR")
  if (book.series.length === 0) issues.push("NO-SERIES")
  return issues
}

function emptyCounts(): Record<AuditIssue, number> {
  return Object.fromEntries(AUDIT_ISSUES.map((issue) => [issue, 0])) as Record<
    AuditIssue,
    number
  >
}

function auditBookFrom(book: AuditBookRow, issues: AuditIssue[]): AuditBook {
  return {
    uuid: book.uuid,
    title: book.title,
    authors: book.authors.map((author) => author.name),
    issues,
  }
}

export async function auditLibrary(): Promise<LibraryAudit> {
  const coversFile = process.env["COVERS_PRESENT_FILE"]
  const coverSet = coversFile ? await loadCoverSet(coversFile) : null
  const books = await getBooks()

  const auditBooks: AuditBook[] = []
  const counts = emptyCounts()

  for (const book of books) {
    const issues = await computeBookIssues(book, coverSet)
    for (const issue of issues) counts[issue]++
    if (issues.length) auditBooks.push(auditBookFrom(book, issues))
  }

  return {
    total: books.length,
    flagged: auditBooks.length,
    counts,
    books: auditBooks,
  }
}

// ---- Background, chunked, cached audit ------------------------------------
//
// Auditing reads every book's cover off disk, far too slow to do on a page
// load. A background pass computes it in chunks of AUDIT_CHUNK, storing the
// result in memory after each chunk; the API serves that cached result
// instantly. The pass runs on boot, after each library scan, and on an
// explicit rescan, so the answer is ready before anyone opens the page.

export type AuditRunStatus = "never" | "computing" | "ready"

export type CachedLibraryAudit = LibraryAudit & {
  status: AuditRunStatus
  computedAt: string | null
  scanned: number
}

declare global {
  // eslint-disable-next-line no-var
  var _libraryAuditCache: CachedLibraryAudit | undefined
  // eslint-disable-next-line no-var
  var _libraryAuditRunning: boolean | undefined
}

const AUDIT_CHUNK = 25

export function getCachedAudit(): CachedLibraryAudit {
  return (
    globalThis._libraryAuditCache ?? {
      total: 0,
      flagged: 0,
      counts: emptyCounts(),
      books: [],
      status: globalThis._libraryAuditRunning ? "computing" : "never",
      computedAt: null,
      scanned: 0,
    }
  )
}

/**
 * Recompute the audit in chunks of {@link AUDIT_CHUNK}, publishing the cached
 * result after each chunk (so progress is visible) and yielding between chunks
 * (so it never blocks the event loop). Only one pass runs at a time.
 */
export async function recomputeAuditInBackground(): Promise<void> {
  if (globalThis._libraryAuditRunning) return
  globalThis._libraryAuditRunning = true

  const previousComputedAt = globalThis._libraryAuditCache?.computedAt ?? null
  try {
    const coversFile = process.env["COVERS_PRESENT_FILE"]
    const coverSet = coversFile ? await loadCoverSet(coversFile) : null
    const books = await getBooks()

    const auditBooks: AuditBook[] = []
    const counts = emptyCounts()

    const publish = (scanned: number, status: AuditRunStatus): void => {
      globalThis._libraryAuditCache = {
        total: books.length,
        flagged: auditBooks.length,
        counts: { ...counts },
        books: [...auditBooks],
        status,
        computedAt:
          status === "ready" ? new Date().toISOString() : previousComputedAt,
        scanned,
      }
    }

    publish(0, "computing")

    for (let i = 0; i < books.length; i += AUDIT_CHUNK) {
      const chunk = books.slice(i, i + AUDIT_CHUNK)
      for (const book of chunk) {
        const issues = await computeBookIssues(book, coverSet)
        for (const issue of issues) counts[issue]++
        if (issues.length) auditBooks.push(auditBookFrom(book, issues))
      }
      publish(Math.min(i + AUDIT_CHUNK, books.length), "computing")
      await new Promise((resolve) => setImmediate(resolve))
    }

    publish(books.length, "ready")
    logger.info({
      msg: "Library audit recomputed",
      total: books.length,
      flagged: auditBooks.length,
    })
  } catch (error) {
    logger.error({ msg: "Library audit recompute failed", err: error })
  } finally {
    globalThis._libraryAuditRunning = false
  }
}

/** Start a recompute without waiting. Safe to call repeatedly (no-op if one is
 * already running). Used by the boot hook and the post-scan hook. */
export function scheduleAuditRecompute(): void {
  void recomputeAuditInBackground()
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length)
}

export async function main() {
  const { total, flagged, counts, books } = await auditLibrary()

  const lines: string[] = []
  lines.push(
    "================= STORYTELLER METADATA AUDIT =====================",
  )
  lines.push(`books total          : ${total}`)
  lines.push(`books with any issue : ${flagged}`)
  lines.push(
    "-----------------------------------------------------------------",
  )
  for (const issue of AUDIT_ISSUES) {
    lines.push(`${pad(issue, 11)} : ${counts[issue]}`)
  }
  lines.push(
    "============== worst first (issues | title) =====================",
  )
  books
    .slice()
    .sort((a, b) => b.issues.length - a.issues.length)
    .slice(0, 60)
    .forEach((b) => {
      lines.push(`${pad(b.issues.join(" "), 40)} | ${b.title.slice(0, 46)}`)
    })
  lines.push(
    "=================================================================",
  )

  // eslint-disable-next-line no-console
  console.log(lines.join("\n"))

  for (const b of books) {
    logger.info({
      msg: "audit",
      issues: b.issues.join(" "),
      title: b.title,
      uuid: b.uuid,
    })
  }
}

if (process.argv[1] === import.meta.filename) {
  void main()
}
