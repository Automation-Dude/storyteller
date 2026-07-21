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

  let docs: SearchDoc[]
  try {
    docs = await runSearch(fielded)
    if (docs.length === 0 && author?.trim()) {
      fielded.delete("author")
      docs = await runSearch(fielded)
    }
    if (docs.length === 0) {
      docs = await runSearch(
        new URLSearchParams({
          q: query,
          lang: "en",
          fields: SEARCH_FIELDS,
          limit: String(limit),
        }),
      )
    }
  } catch (error) {
    logger.warn(
      `Open Library search failed for "${rawTitle}": ${String(error)}`,
    )
    return []
  }

  return docs
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
    .sort((a, b) => b.score - a.score)
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
 * The series an edition claims, when it claims one. Open Library editions
 * write series as loose strings ("Wheel of Time (9)", "The Camel Club #3",
 * "Cradle ; bk. 8"), so the name and number are picked apart here.
 */
export async function fetchOpenLibraryEditionSeries(
  editionKey: string,
): Promise<{ name: string; position: number | null } | null> {
  try {
    const edition = (await fetchJson(`${WORK_URL}${editionKey}.json`)) as {
      series?: string[]
    }
    const raw = edition.series?.[0]?.trim()
    if (!raw) return null
    const match =
      /^(.*?)\s*(?:[(;#,]|bk\.?|book|vol\.?|volume)\s*(\d+(?:\.\d+)?)\s*\)?\s*$/i.exec(
        raw,
      )
    const name = (match?.[1] ?? raw).replace(/[\s\-–—:,;#]+$/, "").trim()
    if (name.length < 3) return null
    const position = match?.[2] ? Number.parseFloat(match[2]) : null
    return { name, position: Number.isFinite(position) ? position : null }
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
