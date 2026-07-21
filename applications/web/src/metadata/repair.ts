import { join } from "node:path"

import { persistCover } from "@/assets/covers"
import { type CreatorRelation, getBook, updateBook } from "@/database/books"
import { backupDatabase } from "@/database/connection"
import { DATA_DIR } from "@/directories"
import { imageStats } from "@/images"
import { logger } from "@/logging"
import { type UUID } from "@/uuid"

import { fetchOpenLibraryDescription } from "./openLibrary"

/**
 * Apply the repairs a person accepts to a book, and the supporting bits the
 * audit flow needs (language normalisation, cover fetch, database backup).
 *
 * The book's metadata is resolved elsewhere (see resolve.ts, which finds and
 * scores matches); this module is the write side: a person decides what to
 * write and the server makes the change. Nothing is written without a database
 * backup first.
 */

/** At or above this score, a match is confident enough to pre-accept. */
export const AUTO_APPLY_SCORE = 0.85
/** Below this, there is no match worth showing; the book needs a person. */
export const SUGGEST_SCORE = 0.3

export type RepairConfidence = "high" | "low" | "none"

/** What a person chose to write to a book. Every field is optional. */
export type RepairChoice = {
  title?: string
  /** Replaces the book's authors; narrators and other creators are kept. */
  authors?: string[]
  language?: string
  /** Plain text or HTML; stored as HTML to match the rest of the app. */
  description?: string
  /** An image URL (Open Library or pasted) to install as the ebook cover. */
  coverUrl?: string
  /** The series this book belongs to; created on the fly when it is new. */
  series?: { name: string; position?: number | null }
}

// Open Library reports language as a 3-letter code; the library's own values
// are 2-letter. Map the common ones, leave anything unknown as given.
const LANGUAGE_CODES: Record<string, string> = {
  eng: "en",
  fre: "fr",
  fra: "fr",
  spa: "es",
  ger: "de",
  deu: "de",
  ita: "it",
  dut: "nl",
  nld: "nl",
  por: "pt",
  rus: "ru",
  jpn: "ja",
  chi: "zh",
  zho: "zh",
}

export function normalizeLanguage(code: string): string {
  const lower = code.trim().toLowerCase()
  return LANGUAGE_CODES[lower] ?? lower
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** Store a description as HTML, matching how the app stores descriptions. */
function asHtml(description: string): string {
  const trimmed = description.trim()
  if (/^\s*</.test(trimmed)) return trimmed // already markup
  return trimmed
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para.trim()).replace(/\n/g, "<br/>")}</p>`)
    .join("")
}

/**
 * Fetch an image URL and confirm it really is a usable image before we let it
 * become a book's cover. Returns null on anything we would not want to install.
 */
export async function fetchCoverImage(
  url: string,
): Promise<{ data: Uint8Array; mimeType: string; filename: string } | null> {
  let bytes: Buffer
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    bytes = Buffer.from(await response.arrayBuffer())
  } catch (error) {
    logger.warn(`repair: cover fetch failed for ${url}: ${String(error)}`)
    return null
  }
  if (bytes.length < 1000) return null // a 1x1 "no cover" pixel, not artwork

  try {
    const { width, height } = await imageStats(bytes)
    if (Math.min(width, height) < 50) return null
  } catch {
    return null // not an image sharp can read
  }

  // PNG magic number; everything else we install as JPEG.
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  return {
    data: new Uint8Array(bytes),
    mimeType: isPng ? "image/png" : "image/jpeg",
    filename: isPng ? "cover.png" : "cover.jpg",
  }
}

/**
 * Apply a chosen repair to one book: metadata through the app's own updateBook,
 * the cover through persistCover (which also clears the resize cache). Authors
 * replace the book's authors while its narrators are preserved.
 */
export async function applyRepair(
  bookUuid: UUID,
  choice: RepairChoice,
  userId?: UUID,
): Promise<{ ok: boolean; message?: string }> {
  const book = await getBook(bookUuid, userId)
  if (!book) return { ok: false, message: "Book not found" }

  const update: {
    title?: string
    language?: string
    description?: string
  } = {}
  if (choice.title?.trim()) update.title = choice.title.trim()
  if (choice.language?.trim())
    update.language = normalizeLanguage(choice.language.trim())
  if (choice.description?.trim())
    update.description = asHtml(choice.description)

  let creators: CreatorRelation[] | undefined
  if (choice.authors?.length) {
    // updateBook replaces ALL creators, so carry the non-author ones (mostly
    // narrators) through, then set the chosen authors.
    const kept: CreatorRelation[] = book.creators
      .filter((creator) => creator.role !== "aut")
      .map((creator) => ({
        name: creator.name,
        fileAs: creator.fileAs,
        uuid: creator.uuid,
        role: creator.role,
      }))
    const authors: CreatorRelation[] = choice.authors.map((name) => ({
      name,
      fileAs: name,
      role: "aut",
    }))
    creators = [...kept, ...authors]
  }

  // updateBook creates a series that does not exist yet and links the book,
  // so a repair can both invent "Cradle" on first use and file book 8 into it.
  const series = choice.series?.name.trim()
    ? [
        {
          name: choice.series.name.trim(),
          featured: true,
          ...(choice.series.position != null && {
            position: choice.series.position,
          }),
        },
      ]
    : undefined

  try {
    const updated =
      Object.keys(update).length || creators || series
        ? await updateBook(
            bookUuid,
            Object.keys(update).length ? update : null,
            { ...(creators && { creators }), ...(series && { series }) },
            userId,
          )
        : book

    if (choice.coverUrl) {
      const cover = await fetchCoverImage(choice.coverUrl)
      if (!cover) return { ok: false, message: "Could not fetch the cover" }
      await persistCover(updated, "ebook", cover)
    }
    return { ok: true }
  } catch (error) {
    logger.error(`repair: failed to apply for ${bookUuid}: ${String(error)}`)
    return { ok: false, message: "Could not save the changes" }
  }
}

/** Take a database snapshot before a bulk write; returns the backup path. */
export async function backupBeforeRepair(): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const path = join(DATA_DIR, "backups", `storyteller-pre-repair-${stamp}.db`)
  const { mkdir } = await import("node:fs/promises")
  await mkdir(join(DATA_DIR, "backups"), { recursive: true })
  await backupDatabase(path)
  return path
}

/** Best-effort description lookup for a book that has none. */
export async function lookupDescription(
  workKey: string,
  editionKey?: string | null,
): Promise<string | null> {
  return fetchOpenLibraryDescription(workKey, editionKey)
}
