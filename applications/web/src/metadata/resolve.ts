import { readdir } from "node:fs/promises"
import { join } from "node:path"

import {
  Audiobook,
  type AudiobookInputs,
} from "@storyteller-platform/audiobook"
import { Epub, MemoryAdapter } from "@storyteller-platform/epub"

import { getExtractedCover } from "@/assets/covers"
import {
  getMetadataFromAudiobook,
  getMetadataFromEpub,
} from "@/assets/metadata"
import { isAudioFile, isJunkFile } from "@/audio"
import { titleIsBad } from "@/database/auditLibrary"
import { type BookWithRelations, getBook } from "@/database/books"
import { isEpubVersionError } from "@/epub"
import { logger } from "@/logging"
import { type UUID } from "@/uuid"

import { combine, isGarbageTitle, seriesFromTitle } from "./localSignals"
import {
  type OpenLibraryCandidate,
  fetchOpenLibraryDescription,
  fetchOpenLibraryEditionSeries,
  searchOpenLibrary,
} from "./openLibrary"
import {
  AUTO_APPLY_SCORE,
  type RepairChoice,
  type RepairConfidence,
  SUGGEST_SCORE,
  normalizeLanguage,
} from "./repair"
import { normalizeForSearch } from "./titleCleaning"

/**
 * Resolve one book's missing metadata in a single pass.
 *
 * The library has no ISBN/ASIN identifiers, so a book's identity can only come
 * from its own title + author. This resolves each book ONCE:
 *   1. Local, authoritative: re-read the book's own files with the same readers
 *      the scanner uses on ingest (embedded audio tags, epub OPF). Anything the
 *      files actually contain is filled without a network call.
 *   2. One catalogue match: for whatever is still missing, clean the title,
 *      search Open Library, and take the single best-scored result. Its
 *      description, language, cover, and (if needed) title/author fill the rest.
 *
 * Every filled field is tagged with where it came from. Nothing is written
 * here; the caller reviews a RepairChoice and applies it through applyRepair.
 */

export type FieldSource = "file" | "openlibrary"

export type BookResolution = {
  bookUuid: UUID
  currentTitle: string
  currentAuthors: string[]
  /** The missing fields we can fill, ready to hand to applyRepair. */
  choice: RepairChoice
  /** Where each filled field came from. */
  sources: Partial<Record<keyof RepairChoice, FieldSource>>
  /** All scored catalogue candidates, for manual review. */
  candidates: OpenLibraryCandidate[]
  /** The single best-scored candidate the fill was drawn from. */
  best: OpenLibraryCandidate | null
  /** Confidence in the catalogue match (none when no lookup was needed/found). */
  confidence: RepairConfidence
}

/** The shape the audit's suggest/repair flow consumes. */
export type RepairProposal = BookResolution

/**
 * The part of a proposal that is safe to apply without a person looking at it.
 *
 * A fill that came out of the book's own files needs no catalogue confidence;
 * it IS the book's data. A fill that came from the catalogue is only safe in
 * bulk when the match scored as confident. Gating the whole proposal on
 * catalogue confidence threw away every file-sourced repair on books the
 * catalogue was unsure about, which collapsed auto-repair coverage.
 */
export function applicableChoice(proposal: RepairProposal): RepairChoice {
  const out: RepairChoice = {}
  const confident = proposal.confidence === "high"
  const usable = (field: keyof RepairChoice) =>
    proposal.sources[field] === "file" || confident
  if (proposal.choice.title && usable("title"))
    out.title = proposal.choice.title
  if (proposal.choice.authors && usable("authors"))
    out.authors = proposal.choice.authors
  if (proposal.choice.language && usable("language"))
    out.language = proposal.choice.language
  if (proposal.choice.description && usable("description"))
    out.description = proposal.choice.description
  if (proposal.choice.coverUrl && usable("coverUrl"))
    out.coverUrl = proposal.choice.coverUrl
  if (proposal.choice.series && usable("series"))
    out.series = proposal.choice.series
  return out
}

type LocalMetadata = {
  title?: string
  description?: string
  language?: string
  authors?: string[]
  series?: { name: string; position?: number | null }
}

/** Read a book's own files with the app's ingest readers. Never throws. */
async function readLocalMetadata(
  book: BookWithRelations,
): Promise<LocalMetadata> {
  const audio = book.audiobook
  if (audio?.filepath && !audio.missing) {
    try {
      const entries = await readdir(audio.filepath, { recursive: true })
      const tracks = entries
        .filter((entry) => isAudioFile(entry) && !isJunkFile(entry))
        .map((entry) => join(audio.filepath, entry)) as AudiobookInputs
      if (tracks.length) {
        using audiobook = await Audiobook.from(...tracks)
        const { update, relations } = await getMetadataFromAudiobook(audiobook)
        return {
          title: update?.title ?? undefined,
          description: update?.description ?? undefined,
          authors: relations.creators
            ?.filter((c) => c.role === "aut")
            .map((c) => c.name),
        }
      }
    } catch (error) {
      logger.warn(
        `resolve: audio read failed for ${book.uuid}: ${String(error)}`,
      )
    }
  }

  const ebook = book.ebook
  if (ebook?.filepath && !ebook.missing) {
    try {
      using reader = await Epub.using(MemoryAdapter).from(ebook.filepath)
      const { update, relations } = await getMetadataFromEpub(reader)
      const opfSeries = relations.series?.[0]
      return {
        title: update?.title ?? undefined,
        description: update?.description ?? undefined,
        language: update?.language ?? undefined,
        authors: relations.creators
          ?.filter((c) => c.role === "aut")
          .map((c) => c.name),
        ...(opfSeries && {
          series: {
            name: opfSeries.name,
            position:
              typeof opfSeries.position === "number"
                ? opfSeries.position
                : null,
          },
        }),
      }
    } catch (error) {
      // An epub2 file the reader won't open is not an error worth logging; the
      // catalogue lookup still covers it.
      if (!isEpubVersionError(error)) {
        logger.warn(
          `resolve: epub read failed for ${book.uuid}: ${String(error)}`,
        )
      }
    }
  }

  return {}
}

function firstNonGarbage(
  ...titles: (string | null | undefined)[]
): string | null {
  for (const t of titles) {
    if (t && t.trim() && !isGarbageTitle(t)) return t.trim()
  }
  return null
}

/**
 * The I/O the resolver depends on, injectable so its decision logic can be
 * proven against controlled inputs without touching the disk or the network.
 */
export type ResolveDeps = {
  loadBook: (uuid: UUID, userId?: UUID) => Promise<BookWithRelations | null>
  readLocal: (book: BookWithRelations) => Promise<LocalMetadata>
  search: (title: string, author?: string) => Promise<OpenLibraryCandidate[]>
  fetchDescription: (
    workKey: string,
    editionKey?: string | null,
  ) => Promise<string | null>
  fetchEditionSeries: (
    editionKey: string,
  ) => Promise<{ name: string; position: number | null } | null>
  hasCover: (book: BookWithRelations) => Promise<boolean>
}

const defaultDeps: ResolveDeps = {
  loadBook: getBook,
  readLocal: readLocalMetadata,
  // A wider result set so the scorer can rank the individual book above an
  // omnibus/box-set edition that shares the title words.
  search: (title, author) => searchOpenLibrary(title, author, 10),
  fetchDescription: fetchOpenLibraryDescription,
  fetchEditionSeries: fetchOpenLibraryEditionSeries,
  hasCover: async (book) =>
    Boolean(
      (await getExtractedCover(book, "ebook")) ??
        (await getExtractedCover(book, "audiobook")),
    ),
}

export async function resolveBook(
  bookUuid: UUID,
  userId?: UUID,
  deps: ResolveDeps = defaultDeps,
): Promise<BookResolution | null> {
  const book = await deps.loadBook(bookUuid, userId)
  if (!book) return null

  const resolution: BookResolution = {
    bookUuid,
    currentTitle: book.title,
    currentAuthors: book.authors.map((a) => a.name),
    choice: {},
    sources: {},
    candidates: [],
    best: null,
    confidence: "none",
  }

  const need = {
    title: titleIsBad(book.title),
    authors: book.authors.length === 0,
    language: !book.language?.trim(),
    description: !book.description?.trim(),
    series: book.series.length === 0,
  }
  if (
    !need.title &&
    !need.authors &&
    !need.language &&
    !need.description &&
    !need.series
  ) {
    return resolution
  }

  // Tier 1: the book's own files, authoritative.
  const local = await deps.readLocal(book)
  if (
    need.title &&
    local.title &&
    !isGarbageTitle(local.title) &&
    local.title !== book.title
  ) {
    resolution.choice.title = local.title
    resolution.sources.title = "file"
    need.title = false
  }
  if (need.authors && local.authors?.length) {
    resolution.choice.authors = local.authors
    resolution.sources.authors = "file"
    need.authors = false
  }
  if (need.language && local.language) {
    resolution.choice.language = normalizeLanguage(local.language)
    resolution.sources.language = "file"
    need.language = false
  }
  if (
    need.description &&
    local.description &&
    local.description.trim().length > 20
  ) {
    resolution.choice.description = local.description.trim()
    resolution.sources.description = "file"
    need.description = false
  }
  if (need.series) {
    // The epub's OPF names the series outright; failing that, the title
    // itself often wraps it ("Wintersteel (Cradle Book 8)").
    const embedded =
      local.series ??
      seriesFromTitle(local.title ?? "") ??
      seriesFromTitle(book.title)
    if (embedded) {
      resolution.choice.series = {
        name: embedded.name,
        position: embedded.position ?? null,
      }
      resolution.sources.series = "file"
      need.series = false
    }
  }

  // Tier 2: one catalogue match for whatever the files did not supply.
  if (
    need.title ||
    need.authors ||
    need.language ||
    need.description ||
    need.series
  ) {
    const folder = combine(book.title, book.assetDir, undefined)
    const queryTitle = normalizeForSearch(
      firstNonGarbage(local.title, folder.title, book.title) ?? book.title,
    )
    if (queryTitle && !isGarbageTitle(queryTitle)) {
      const author =
        book.authors[0]?.name.replace(/^by\s+/i, "") ??
        local.authors?.[0] ??
        folder.author ??
        undefined
      const candidates = await deps.search(queryTitle, author)
      const best = candidates[0] ?? null
      resolution.candidates = candidates
      resolution.best = best
      resolution.confidence = best
        ? best.score >= AUTO_APPLY_SCORE
          ? "high"
          : best.score >= SUGGEST_SCORE
            ? "low"
            : "none"
        : "none"

      if (best && best.score >= SUGGEST_SCORE) {
        if (need.title && best.title && !isGarbageTitle(best.title)) {
          resolution.choice.title = best.title
          resolution.sources.title = "openlibrary"
        }
        if (need.authors && best.authors.length) {
          resolution.choice.authors = best.authors
          resolution.sources.authors = "openlibrary"
        }
        // Open Library's language list is every edition's language, so picking
        // one would tag an English audiobook Polish. Only fill when it confirms
        // an English edition exists; otherwise leave language for a person.
        if (need.language && best.languages.includes("eng")) {
          resolution.choice.language = "en"
          resolution.sources.language = "openlibrary"
        }
        if (need.description) {
          const description = await deps.fetchDescription(
            best.workKey,
            best.editionKey,
          )
          if (description && description.length > 20) {
            resolution.choice.description = description
            resolution.sources.description = "openlibrary"
          }
        }
        // The matched edition often names its series; only a high-confidence
        // match may file a book into a series, a guess here is worse than a
        // gap.
        if (need.series && best.editionKey && best.score >= AUTO_APPLY_SCORE) {
          const editionSeries = await deps.fetchEditionSeries(best.editionKey)
          if (editionSeries) {
            resolution.choice.series = editionSeries
            resolution.sources.series = "openlibrary"
          }
        }
        // A cover only when the book has none, so we never overwrite one a
        // person already curated.
        if (best.coverUrl && !(await deps.hasCover(book))) {
          resolution.choice.coverUrl = best.coverUrl
          resolution.sources.coverUrl = "openlibrary"
        }
      }
    }
  }

  return resolution
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const queue = items.map((item, index) => ({ item, index }))
  const results: R[] = []
  async function worker() {
    for (;;) {
      const job = queue.shift()
      if (!job) return
      results[job.index] = await fn(job.item)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )
  return results
}

/**
 * Resolve a batch of books, a few at a time to stay a good citizen of the free
 * catalogue. Books that no longer exist are dropped.
 */
export async function proposeForBooks(
  bookUuids: UUID[],
  userId?: UUID,
): Promise<RepairProposal[]> {
  const resolutions = await mapWithConcurrency(bookUuids, 4, (bookUuid) =>
    resolveBook(bookUuid, userId),
  )
  return resolutions.filter((r): r is RepairProposal => r !== null)
}
