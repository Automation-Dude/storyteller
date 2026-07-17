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

const SEARCH_FIELDS =
  "key,title,author_name,first_publish_year,cover_i,edition_count,isbn,language"

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
  /** How well this matches what we searched for, 0 (no) to 1 (yes). */
  score: number
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
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } })
  if (!response.ok) {
    throw new Error(`Open Library ${response.status} for ${url}`)
  }
  return response.json()
}

/**
 * Look a book up on Open Library and score the results against what we asked
 * for. The title is normalised first, so an ingestion-mangled name still finds
 * the book; an author, when we have one, both narrows the search and is the
 * strongest signal that a result is the right book.
 */
export async function searchOpenLibrary(
  rawTitle: string,
  author?: string,
  limit = 5,
): Promise<OpenLibraryCandidate[]> {
  const query = normalizeForSearch(rawTitle)
  if (!query) return []

  // The author is used only to score results, never to filter the search: a
  // book's stored author is sometimes wrong (a collection name, an uploader),
  // and filtering on it would hide the very book we are trying to find.
  const params = new URLSearchParams({
    q: query,
    fields: SEARCH_FIELDS,
    limit: String(limit),
  })

  let docs: SearchDoc[]
  try {
    const body = (await fetchJson(`${SEARCH_URL}?${params.toString()}`)) as {
      docs?: SearchDoc[]
    }
    docs = body.docs ?? []
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
      const coverId = doc.cover_i ?? null
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
        score: scoreMatch(
          {
            title: doc.title,
            authorNames: doc.author_name ?? [],
            editionCount: doc.edition_count ?? 0,
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

/** A work's description, when it has one. Open Library often does not. */
export async function fetchOpenLibraryDescription(
  workKey: string,
): Promise<string | null> {
  try {
    const work = (await fetchJson(`${WORK_URL}${workKey}.json`)) as {
      description?: string | { value?: string }
    }
    const description =
      typeof work.description === "string"
        ? work.description
        : work.description?.value
    return description?.trim() ? description.trim() : null
  } catch {
    return null
  }
}
