import { readFile } from "node:fs/promises"

import { getExtractedCover } from "@/assets/covers"
import { logger } from "@/logging"

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

type Issue = "NO-COVER" | "NO-AUTHOR" | "NO-LANG" | "NO-DESC" | "BAD-TITLE"

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

function titleIsBad(title: string | null): boolean {
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

export async function auditLibrary() {
  const coversFile = process.env["COVERS_PRESENT_FILE"]
  const coverSet = coversFile ? await loadCoverSet(coversFile) : null

  const books = await getBooks()

  async function hasCover(book: (typeof books)[number]): Promise<boolean> {
    if (coverSet) return !!book.assetDir && coverSet.has(book.assetDir)
    // In-environment: ask the same function the Kobo cover route asks.
    const ebook = await getExtractedCover(book, "ebook")
    if (ebook) return true
    return !!(await getExtractedCover(book, "audiobook"))
  }

  const rows: { issues: Issue[]; title: string; uuid: string }[] = []
  const counts: Record<Issue, number> = {
    "NO-COVER": 0,
    "NO-AUTHOR": 0,
    "NO-LANG": 0,
    "NO-DESC": 0,
    "BAD-TITLE": 0,
  }

  for (const book of books) {
    const issues: Issue[] = []

    if (!(await hasCover(book))) issues.push("NO-COVER")
    if (book.authors.length === 0) issues.push("NO-AUTHOR")
    if (!book.language || !book.language.trim()) issues.push("NO-LANG")
    if (!book.description || !book.description.trim()) issues.push("NO-DESC")
    if (titleIsBad(book.title)) issues.push("BAD-TITLE")

    for (const issue of issues) counts[issue]++
    if (issues.length) rows.push({ issues, title: book.title, uuid: book.uuid })
  }

  return { total: books.length, counts, rows }
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length)
}

export async function main() {
  const { total, counts, rows } = await auditLibrary()

  const lines: string[] = []
  lines.push(
    "================= STORYTELLER METADATA AUDIT =====================",
  )
  lines.push(`books total          : ${total}`)
  lines.push(`books with any issue : ${rows.length}`)
  lines.push(
    "-----------------------------------------------------------------",
  )
  for (const issue of [
    "NO-COVER",
    "NO-AUTHOR",
    "NO-LANG",
    "NO-DESC",
    "BAD-TITLE",
  ] as const) {
    lines.push(`${pad(issue, 10)} : ${counts[issue]}`)
  }
  lines.push(
    "============== worst first (issues | title) =====================",
  )
  rows
    .slice()
    .sort((a, b) => b.issues.length - a.issues.length)
    .slice(0, 60)
    .forEach((r) => {
      lines.push(`${pad(r.issues.join(" "), 34)} | ${r.title.slice(0, 52)}`)
    })
  lines.push(
    "=================================================================",
  )

  // eslint-disable-next-line no-console
  console.log(lines.join("\n"))

  // The full list as TSV on stderr, so stdout stays the readable summary.
  for (const r of rows) {
    logger.info({
      msg: "audit",
      issues: r.issues.join(" "),
      title: r.title,
      uuid: r.uuid,
    })
  }
}

if (process.argv[1] === import.meta.filename) {
  void main()
}
