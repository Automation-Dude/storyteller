import { logger } from "@/logging"

import { normalizeForSearch, scoreMatch } from "./titleCleaning"

/**
 * A metadata source backed by Open Library (openlibrary.org).
 *
 * Chosen because it is free, needs no key, and its data is open. It is weaker
 * on brand-new or niche titles and its descriptions are patchy, so this is
 * best-effort: a good match improves a book, a poor one is left for a person.
 */

const SEARCH_URL = "https://openlibrary.org/search.json"
const COVER_URL = "https://covers.openlibrary.org/b/id"
const WORK_URL = "https://openlibrary.org"

// Open Library asks callers to identify themselves so they can get in touch.
const USER_AGENT =
  "Storyteller-library-audit/1.0 (self-hosted; +https://gitlab.com/storyteller-platform/storyteller)"

const SEARCH_FIELDS = [
  "key,title,author_name,first_publish_year,cover_i,edition_count,isbn",
  "language,ratings_average,ratings_count",
  // The best matching edition per work: Open Library boosts it by the caller's
  // language, readability, and cover availability. Its cover is an English
  // edition's cover instead of whatever random edition the work defaults to.
  "editions,editions.key,editions.language,editions.covers",
].join(",")

export type OpenLibraryCandidate = {
  /** The Open Library work key, e.g. "/works/OL45883W". */
  workKey: string
  title: string
  authors: string[]
  firstPublishYear: number | null
  coverId: number | null
  /** A large cover image, or null when the work has no cover on file. */
  coverUrl: string | null
  isbn: string | null
  languages: string[]
  editionCount: number
  /** The work's best matching edition (English-boosted), when reported. */
  editionKey: string | null
  ratingsAverage: number | null
  ratingsCount: number
  /** How well this matches what we searched for, 0 (no) to 1 (yes). */
  score: number
  /** Filled by the manual-search route for top candidates; not set by search. */
  description?: string | null
}

type EditionDoc = {
  key?: string
  language?: string[]
  covers?: number[]
}

type SearchDoc = {
  key?: string
  title?: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  edition_count?: number
  isbn?: string[]
  language?: string[]
  ratings_average?: number
  ratings_count?: number
  editions?: { docs?: EditionDoc[] }
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } })
  if (!response.ok) {
    throw new Error(`Open Library ${response.status} for ${url}`)
  }
  return response.json()
}

async function runSearch(params: URLSearchParams): Promise<SearchDoc[]> {
  const body = (await fetchJson(`${SEARCH_URL}?${params.toString()}`)) as {
    docs?: SearchDoc[]
  }
  return body.docs ?? []
}

/**
 * Look a book up on Open Library and score the results against what we asked
 * for.
 *
 * The primary search uses the dedicated title/author fields with an English
 * language boost, the way the Open Library site itself searches; a bare
 * keyword query drags in orphaned works ("Vaccination, the silent killer" for
 * "Clear and Present Danger") and randomly-translated covers. If the fielded
 * search finds nothing (badly mangled titles), it falls back to the loose
 * keyword form.
 */
// Below this match score a candidate is too weak to trust; it mirrors the
// suggest threshold in repair.ts, kept local here to avoid a circular import.
const WEAK_MATCH_SCORE = 0.3

export async function searchOpenLibrary(
  rawTitle: string,
  author?: string,
  limit = 5,
): Promise<OpenLibraryCandidate[]> {
  const query = normalizeForSearch(rawTitle)
  if (!query) return []

  const fielded = new URLSearchParams({
    title: query,
    lang: "en",
    fields: SEARCH_FIELDS,
    limit: String(limit),
  })
  // The author narrows the fielded search; the keyword fallback drops it, so a
  // wrong stored author (a collection name, an uploader) cannot hide the book.
  if (author?.trim()) fielded.set("author", author.trim())

  const toCandidates = (docs: SearchDoc[]): OpenLibraryCandidate[] =>
    docs
      .filter((doc): doc is SearchDoc & { key: string; title: string } =>
        Boolean(doc.key && doc.title),
      )
      .map((doc) => {
        const edition = doc.editions?.docs?.[0] ?? null
        const editionCoverId = edition?.covers?.[0] ?? null
        const coverId = editionCoverId ?? doc.cover_i ?? null
        return {
          workKey: doc.key,
          title: doc.title,
          authors: doc.author_name ?? [],
          firstPublishYear: doc.first_publish_year ?? null,
          coverId,
          coverUrl: coverId ? `${COVER_URL}/${coverId}-L.jpg` : null,
          isbn: doc.isbn?.[0] ?? null,
          languages: doc.language ?? [],
          editionCount: doc.edition_count ?? 0,
          editionKey: edition?.key ?? null,
          ratingsAverage: doc.ratings_average ?? null,
          ratingsCount: doc.ratings_count ?? 0,
          score: scoreMatch(
            {
              title: doc.title,
              authorNames: doc.author_name ?? [],
              editionCount: doc.edition_count ?? 0,
              ratingsCount: doc.ratings_count ?? 0,
            },
            query,
            author,
          ),
        }
      })

  try {
    let candidates = toCandidates(await runSearch(fielded))
    // A wrong or handle-style stored author ("NYC.HarDCorE") narrows the
    // fielded search onto junk, and the old code only retried without it when
    // there were zero results, so any junk hit locked the real book out. When
    // the best author-fielded hit is weak, search again without the author and
    // keep both result sets, so the book found by title alone can still win.
    if (author?.trim() && (candidates[0]?.score ?? 0) < WEAK_MATCH_SCORE) {
      fielded.delete("author")
      candidates = dedupeByWork([
        ...candidates,
        ...toCandidates(await runSearch(fielded)),
      ])
    }
    if (candidates.length === 0) {
      candidates = toCandidates(
        await runSearch(
          new URLSearchParams({
            q: query,
            lang: "en",
            fields: SEARCH_FIELDS,
            limit: String(limit),
          }),
        ),
      )
    }
    return candidates.sort((a, b) => b.score - a.score)
  } catch (error) {
    logger.warn(
      `Open Library search failed for "${rawTitle}": ${String(error)}`,
    )
    return []
  }
}

/** Keep the highest-scoring candidate per work when result sets are merged. */
function dedupeByWork(
  candidates: OpenLibraryCandidate[],
): OpenLibraryCandidate[] {
  const best = new Map<string, OpenLibraryCandidate>()
  for (const candidate of candidates) {
    const prev = best.get(candidate.workKey)
    if (!prev || candidate.score > prev.score)
      best.set(candidate.workKey, candidate)
  }
  return [...best.values()]
}

/** The single best match, or null if nothing was returned. */
export async function bestOpenLibraryMatch(
  rawTitle: string,
  author?: string,
): Promise<OpenLibraryCandidate | null> {
  const [best] = await searchOpenLibrary(rawTitle, author)
  return best ?? null
}

/** Download a cover's bytes, or null if the work has none / it fails. */
export async function fetchOpenLibraryCover(
  candidate: OpenLibraryCandidate,
): Promise<Buffer | null> {
  if (!candidate.coverUrl) return null
  try {
    const response = await fetch(candidate.coverUrl, {
      headers: { "User-Agent": USER_AGENT },
    })
    if (!response.ok) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    // Open Library serves a tiny 1x1 (or a "no cover" pixel) when it has none;
    // treat anything implausibly small as no cover rather than a real image.
    return bytes.length > 1000 ? bytes : null
  } catch (error) {
    logger.warn(`Open Library cover fetch failed: ${String(error)}`)
    return null
  }
}

/**
 * Publisher imprints and collections that masquerade as series on editions.
 * "Spectra" or "SF Masterworks" is stamped on every book the imprint prints,
 * so it wins any edition vote while being no series at all; writing one as a
 * series is exactly the wrong-data class the audit exists to prevent.
 */
const IMPRINT_NAMES = new Set([
  "spectra",
  "orbit",
  "tor",
  "del rey",
  "gollancz",
  "vintage",
  "bantam",
  "ace",
  "roc",
  "daw",
  "baen",
  "penguin",
  "puffin",
  "corgi",
  "voyager",
  "harper voyager",
])

const IMPRINT_PATTERN =
  /\b(masterworks|classics|essentials|omnibus|anthology|selection|library binding|book club)\b/i

/** True when a "series" name is really a publisher imprint or collection. */
export function isImprintName(name: string): boolean {
  return (
    IMPRINT_NAMES.has(name.trim().toLowerCase()) || IMPRINT_PATTERN.test(name)
  )
}

/**
 * Pick a series name and number out of an edition's loose series string
 * ("Wheel of Time (9)", "The Camel Club #3", "Cradle ; bk. 8").
 *
 * Editions often carry a COMPOUND claim ("The Riftwar Saga (#4); Riftwar
 * Cycle (#3)"); taking it verbatim mangled real series names into garbage
 * rows, so only the first claim is read. A semicolon directly before a
 * number ("Cradle ; bk. 8") is a separator inside one claim and stays.
 */
export function parseSeriesString(
  raw: string | undefined,
): { name: string; position: number | null } | null {
  let value = raw?.trim()
  if (!value) return null
  const semicolon = value.indexOf(";")
  if (semicolon > 0) {
    const rest = value.slice(semicolon + 1).trim()
    // A number right after the semicolon is this claim's own position marker
    // ("Cradle ; bk. 8"); anything else starts a second claim to drop.
    if (!/^(?:bk\.?|book|vol\.?|volume|#|no\.?|\d)/i.test(rest)) {
      value = value.slice(0, semicolon).trim()
    }
  }
  const match =
    /^(.*?)\s*(?:[(;#,]|bk\.?|book|vol\.?|volume)\s*(\d+(?:\.\d+)?)\s*\)?\s*$/i.exec(
      value,
    )
  const name = (match?.[1] ?? value)
    .replace(/[\s\-–—:,;#(]+$/, "")
    // "Discworld series" and "Discworld" are the same series; the suffix only
    // splits the vote and hides the numbered form. "Saga" and "Cycle" stay:
    // they are usually part of the official name ("The Riftwar Saga").
    .replace(/\s+(series|novels?)$/i, "")
    .trim()
  if (name.length < 3) return null
  if (isImprintName(name)) return null
  const position = match?.[2] ? Number.parseFloat(match[2]) : null
  return { name, position: Number.isFinite(position) ? position : null }
}

/** The series an edition claims, when it claims one. */
export async function fetchOpenLibraryEditionSeries(
  editionKey: string,
): Promise<{ name: string; position: number | null } | null> {
  try {
    const edition = (await fetchJson(`${WORK_URL}${editionKey}.json`)) as {
      series?: string[]
    }
    return parseSeriesString(edition.series?.[0])
  } catch {
    return null
  }
}

/**
 * The series a work belongs to, judged across ALL of its editions.
 *
 * A single edition often omits the series, but a work with dozens of editions
 * usually has several that name it ("Discworld #12"). The most commonly named
 * series wins, and the first edition that also numbers it supplies the
 * position. One extra request per book, only asked for when nothing local
 * answered the question.
 */
export async function fetchOpenLibraryWorkSeries(
  workKey: string,
): Promise<{ name: string; position: number | null } | null> {
  try {
    const body = (await fetchJson(
      `${WORK_URL}${workKey}/editions.json?limit=50`,
    )) as { entries?: { series?: string[] }[] }
    const votes = new Map<string, { count: number; position: number | null }>()
    for (const entry of body.entries ?? []) {
      const parsed = parseSeriesString(entry.series?.[0])
      if (!parsed) continue
      const key = parsed.name.toLowerCase()
      const vote = votes.get(key) ?? { count: 0, position: null }
      vote.count += 1
      vote.position ??= parsed.position
      votes.set(key, vote)
    }
    let best: { name: string; position: number | null; count: number } | null =
      null
    for (const [key, vote] of votes) {
      if (!best || vote.count > best.count) {
        best = { name: key, position: vote.position, count: vote.count }
      }
    }
    // One edition claiming a series is how a standalone ends up filed under a
    // publisher's collection name; a real series is named by several editions.
    if (!best || best.count < 2) return null
    // Recover the original casing from any edition that used this name.
    for (const entry of body.entries ?? []) {
      const parsed = parseSeriesString(entry.series?.[0])
      if (parsed && parsed.name.toLowerCase() === best.name) {
        return { name: parsed.name, position: best.position }
      }
    }
    return null
  } catch {
    return null
  }
}

function textOf(value: string | { value?: string } | undefined): string | null {
  const text = typeof value === "string" ? value : value?.value
  return text?.trim() ? text.trim() : null
}

/**
 * A book's description: the work's own, else the best edition's, else the
 * work's excerpt/first sentence as a last resort. Each source is tried because
 * Open Library scatters blurbs across all three.
 */
export async function fetchOpenLibraryDescription(
  workKey: string,
  editionKey?: string | null,
): Promise<string | null> {
  try {
    const work = (await fetchJson(`${WORK_URL}${workKey}.json`)) as {
      description?: string | { value?: string }
      excerpts?: { excerpt?: string | { value?: string } }[]
      first_sentence?: string | { value?: string }
    }
    const description = textOf(work.description)
    if (description) return description

    if (editionKey) {
      try {
        const edition = (await fetchJson(`${WORK_URL}${editionKey}.json`)) as {
          description?: string | { value?: string }
        }
        const editionDescription = textOf(edition.description)
        if (editionDescription) return editionDescription
      } catch {
        // fall through to excerpts
      }
    }

    for (const excerpt of work.excerpts ?? []) {
      const text = textOf(excerpt.excerpt)
      if (text && text.length > 60) return text
    }
    return textOf(work.first_sentence)
  } catch {
    return null
  }
}
