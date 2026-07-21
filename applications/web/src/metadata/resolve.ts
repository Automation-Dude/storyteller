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

import {
  authorNameIsBad,
  cleanAuthorName,
  combine,
  editDistance,
  isGarbageTitle,
  pathSignals,
  seriesFromTitle,
} from "./localSignals"
import {
  type OpenLibraryCandidate,
  fetchOpenLibraryDescription,
  fetchOpenLibraryEditionSeries,
  fetchOpenLibraryWorkSeries,
  searchOpenLibrary,
} from "./openLibrary"
import {
  AUTO_APPLY_SCORE,
  type RepairChoice,
  type RepairConfidence,
  SUGGEST_SCORE,
  normalizeLanguage,
} from "./repair"
import {
  authorsMatch,
  bestTitleSimilarity,
  queryVariants,
  seriesNamesMatch,
} from "./titleCleaning"

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

/**
 * Where a proposed fill came from: the book's own files, the catalogue, or a
 * deterministic cleanup of data the book already had ("derived").
 */
export type FieldSource = "file" | "openlibrary" | "derived"

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
  fetchWorkSeries: (
    workKey: string,
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
  fetchWorkSeries: fetchOpenLibraryWorkSeries,
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
    authors:
      book.authors.length === 0 ||
      book.authors.some((a) => authorNameIsBad(a.name)),
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
  // Where the book lives on disk is metadata too: a curated tree names the
  // author and the title in the directories and the filename themselves.
  const paths = [
    pathSignals(book.ebook?.filepath),
    pathSignals(book.audiobook?.filepath),
  ]
  const pathAuthors = paths.flatMap((p) => p.authors)
  const pathTitles = paths.flatMap((p) => p.titles)
  const pathYears = paths.flatMap((p) => p.years)
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
    // Tags carry the same damage the database does (underscores, "By "
    // prefixes, a collection name where the author belongs); clean before
    // trusting, and never refill garbage.
    const usable = local.authors
      .map((name) => cleanAuthorName(name))
      .filter((name, index, all) => name && all.indexOf(name) === index)
      .filter((name) => !authorNameIsBad(name))
    if (usable.length) {
      resolution.choice.authors = usable
      resolution.sources.authors = "file"
      need.authors = false
    }
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
  if (need.authors && book.authors.length > 0) {
    // The names on the book may just be damaged forms of the right person
    // ("Narrated by X", "Cornwell, Bernard"); a deterministic cleanup is
    // always safe to propose, and the catalogue can still improve on it.
    const cleaned = book.authors
      // A narration credit never contained the author's name, so cleaning it
      // would crown the narrator; those wait for the file or the catalogue.
      .filter((a) => !/^(narrated by|read by|performed by)\s/i.test(a.name))
      .map((a) => cleanAuthorName(a.name))
      .filter((name, index, all) => name && all.indexOf(name) === index)
      // A collection name riding along a real author ("Dan Simmons; Top 100
      // Sci-Fi Books") is dropped, not kept for company.
      .filter((name, _, all) => !authorNameIsBad(name) || all.length === 1)
    if (
      cleaned.length &&
      !cleaned.every(authorNameIsBad) &&
      JSON.stringify(cleaned) !==
        JSON.stringify(book.authors.map((a) => a.name))
    ) {
      resolution.choice.authors = cleaned
      resolution.sources.authors = "derived"
      need.authors = false
    }
  }
  if (need.authors && pathAuthors.length) {
    // The library tree itself names the author ("books/Sarah J Maas/...");
    // deterministic to read, safe to propose, and the catalogue can still
    // improve the spelling on a confident match.
    const [pathAuthor] = pathAuthors.filter((name) => !authorNameIsBad(name))
    if (pathAuthor) {
      resolution.choice.authors = [pathAuthor]
      resolution.sources.authors = "derived"
      need.authors = false
    }
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
    // A healthy stored title is the curated truth; tag and folder titles only
    // matter when the stored one is broken. Preferring a tag title over a
    // clean stored title sent searches for \"Dune\" off after tag garbage.
    const baseTitle = !titleIsBad(book.title)
      ? book.title
      : firstNonGarbage(local.title, folder.title, ...pathTitles, book.title) ??
        book.title
    // A known-bad stored author must not narrow the search or score the
    // match; it penalises the right book for not matching garbage.
    const authorCandidates = [
      ...book.authors.map((a) => a.name.replace(/^by\s+/i, "")),
      ...(local.authors ?? []),
      ...pathAuthors,
      folder.author ?? "",
    ]
    const author = authorCandidates.find(
      (name) => name && !authorNameIsBad(name),
    )
    // Every usable author signal the book carries, not just the one the query
    // uses: the stored row, the file tags, and the folder name each name an
    // author independently, so ANY of them agreeing with a match confirms it
    // even when the signal the search used was the wrong one.
    const authorSignals = authorCandidates
      .map((name) => cleanAuthorName(name))
      .filter((name, index, all) => name && all.indexOf(name) === index)
      .filter((name) => !authorNameIsBad(name))

    // Progressive discovery: a stored title often buries the real one under
    // series clutter, so each cleaner variant is tried until a match is
    // confident. The best attempt across all rungs is kept either way.
    let best: OpenLibraryCandidate | null = null
    for (const queryTitle of queryVariants(baseTitle)) {
      if (isGarbageTitle(queryTitle)) continue
      const candidates = await deps.search(queryTitle, author)
      const rung = candidates[0] ?? null
      if (rung && (!best || rung.score > best.score)) {
        best = rung
        resolution.candidates = candidates
      }
      if (best && best.score >= AUTO_APPLY_SCORE) break
    }
    {
      resolution.best = best
      // A matching author is the strongest confirmation there is: when ANY of
      // the book's own author signals (stored, file tag, folder) agrees with
      // the match and the titles overlap, the match is confident even if
      // clutter dragged the composite score down.
      const authorConfirmed = Boolean(
        best &&
          best.score >= SUGGEST_SCORE &&
          bestTitleSimilarity(best.title, baseTitle) >= 0.5 &&
          authorSignals.some((signal) =>
            best.authors.some((name) => authorsMatch(name, signal)),
          ),
      )
      // With no usable author to confirm against, an exact title on a work
      // the world has printed many times is its own confirmation; without
      // this, a garbage-author book can never reach confidence at all.
      const titleWords = baseTitle.trim().split(/\s+/).length
      const canonicalConfirmed = Boolean(
        authorSignals.length === 0 &&
          best &&
          bestTitleSimilarity(best.title, baseTitle) >= 0.95 &&
          // A one-word title needs a much larger body of editions before it
          // can vouch for itself; \"Dune\" qualifies, an obscure one-worder
          // does not.
          best.editionCount >= (titleWords >= 2 ? 10 : 30),
      )
      // A publication year in the book's own path agreeing with the work's
      // first-publish year is one more independent voice; it only ever
      // promotes a match whose title already overlaps strongly.
      const yearConfirmed = Boolean(
        best &&
          best.score >= SUGGEST_SCORE &&
          best.firstPublishYear !== null &&
          pathYears.some(
            (year) => Math.abs(year - (best.firstPublishYear ?? 0)) <= 1,
          ) &&
          bestTitleSimilarity(best.title, baseTitle) >= 0.7,
      )
      resolution.confidence = best
        ? best.score >= AUTO_APPLY_SCORE ||
          authorConfirmed ||
          canonicalConfirmed ||
          yearConfirmed
          ? "high"
          : best.score >= SUGGEST_SCORE
            ? "low"
            : "none"
        : "none"

      // A series clue in the book's own data agreeing with the catalogue's
      // series for the matched work is two independent sources naming the
      // same thing; that confirms a match the score alone left uncertain.
      let confirmedSeries: { name: string; position: number | null } | null =
        null
      if (best && resolution.confidence === "low") {
        const expectedSeries =
          book.series[0]?.name ??
          local.series?.name ??
          seriesFromTitle(local.title ?? "")?.name ??
          seriesFromTitle(book.title)?.name
        if (expectedSeries) {
          confirmedSeries =
            (best.editionKey
              ? await deps.fetchEditionSeries(best.editionKey)
              : null) ?? (await deps.fetchWorkSeries(best.workKey))
          if (
            confirmedSeries &&
            seriesNamesMatch(confirmedSeries.name, expectedSeries)
          ) {
            resolution.confidence = "high"
          }
        }
      }

      if (best && resolution.confidence !== "none") {
        if (need.title && best.title && !isGarbageTitle(best.title)) {
          resolution.choice.title = best.title
          resolution.sources.title = "openlibrary"
        }
        if (need.authors && best.authors.length) {
          resolution.choice.authors = best.authors
          resolution.sources.authors = "openlibrary"
        }
        // A stored author a keystroke away from the confident match's author
        // is a typo ("Anne McCaffery"); the catalogue's spelling wins.
        if (
          !need.authors &&
          resolution.confidence === "high" &&
          !resolution.choice.authors &&
          book.authors.length === 1 &&
          best.authors[0]
        ) {
          const stored = book.authors[0]?.name ?? ""
          const matched = best.authors[0]
          const distance = editDistance(
            stored.toLowerCase(),
            matched.toLowerCase(),
          )
          if (distance > 0 && distance <= 2) {
            resolution.choice.authors = [matched]
            resolution.sources.authors = "openlibrary"
          }
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
        // Series discovery ladder: the matched edition first, then a vote
        // across ALL of the work's editions (one edition often omits the
        // series a dozen others name). Only a confident match may file a book
        // into a series; a guess here is worse than a gap.
        if (need.series && resolution.confidence === "high") {
          const editionSeries =
            confirmedSeries ??
            (best.editionKey
              ? await deps.fetchEditionSeries(best.editionKey)
              : null) ??
            (await deps.fetchWorkSeries(best.workKey))
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
