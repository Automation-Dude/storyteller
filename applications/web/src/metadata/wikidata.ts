import { logger } from "@/logging"

/**
 * Name the volumes of a book series. Open Library has no series entity at
 * all (series there are loose strings on editions), while Wikidata models a
 * book series as an item whose parts carry an ordinal, which is exactly the
 * "what is book 4 called" question the series audit asks. Free, no key, one
 * entity search plus two entity fetches per series.
 */

const API = "https://www.wikidata.org/w/api.php"

const USER_AGENT =
  "Storyteller-library-audit/1.0 (self-hosted; +https://gitlab.com/storyteller-platform/storyteller)"

export type SeriesPart = { ordinal: number | null; title: string }

type SearchCandidate = { id: string; label: string; description: string }

async function fetchJson(params: URLSearchParams): Promise<unknown> {
  params.set("format", "json")
  params.set("origin", "*")
  const response = await fetch(`${API}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
  })
  if (!response.ok) throw new Error(`Wikidata ${response.status}`)
  return response.json()
}

/**
 * The search candidate that is actually a book series, preferring one whose
 * description names the expected author. Exported for tests.
 */
export function pickSeriesEntity(
  candidates: SearchCandidate[],
  authorHint?: string | null,
): SearchCandidate | null {
  const isSeries = (c: SearchCandidate) =>
    /\b(book|novel|fantasy|science fiction|literary|comic)?\s*series\b/i.test(
      c.description,
    )
  const seriesOnly = candidates.filter(isSeries)
  if (authorHint) {
    const surname = authorHint.trim().split(/\s+/).pop()?.toLowerCase()
    if (surname && surname.length > 2) {
      const byAuthor = seriesOnly.find((c) =>
        c.description.toLowerCase().includes(surname),
      )
      if (byAuthor) return byAuthor
    }
  }
  return seriesOnly[0] ?? null
}

/** The part ids and ordinals in a P527 (has part) claims payload. Exported
 * for tests. */
export function partsFromClaims(
  body: unknown,
): { id: string; ordinal: number | null }[] {
  const claims = (
    body as {
      claims?: {
        P527?: {
          mainsnak?: { datavalue?: { value?: { id?: string } } }
          qualifiers?: { P1545?: { datavalue?: { value?: string } }[] }
        }[]
      }
    }
  ).claims?.P527
  if (!claims) return []
  const out: { id: string; ordinal: number | null }[] = []
  for (const claim of claims) {
    const id = claim.mainsnak?.datavalue?.value?.id
    if (!id) continue
    const raw = claim.qualifiers?.P1545?.[0]?.datavalue?.value
    const ordinal = raw ? Number.parseFloat(raw) : Number.NaN
    out.push({ id, ordinal: Number.isFinite(ordinal) ? ordinal : null })
  }
  return out
}

/**
 * The named, numbered volumes of a series, or null when Wikidata does not
 * know the series (or models it without parts). Best-effort by design.
 */
export async function fetchWikidataSeriesParts(
  name: string,
  authorHint?: string | null,
): Promise<{ entityLabel: string; parts: SeriesPart[] } | null> {
  try {
    const search = (await fetchJson(
      new URLSearchParams({
        action: "wbsearchentities",
        search: name,
        language: "en",
        type: "item",
        limit: "10",
      }),
    )) as { search?: { id?: string; label?: string; description?: string }[] }
    const candidates: SearchCandidate[] = (search.search ?? [])
      .filter((c): c is { id: string; label: string; description?: string } =>
        Boolean(c.id && c.label),
      )
      .map((c) => ({
        id: c.id,
        label: c.label,
        description: c.description ?? "",
      }))
    const entity = pickSeriesEntity(candidates, authorHint)
    if (!entity) return null

    const claims = await fetchJson(
      new URLSearchParams({
        action: "wbgetclaims",
        entity: entity.id,
        property: "P527",
      }),
    )
    const parts = partsFromClaims(claims)
    if (parts.length === 0) return { entityLabel: entity.label, parts: [] }

    const labels = (await fetchJson(
      new URLSearchParams({
        action: "wbgetentities",
        ids: parts
          .slice(0, 50)
          .map((p) => p.id)
          .join("|"),
        props: "labels",
        languages: "en",
      }),
    )) as {
      entities?: Record<string, { labels?: { en?: { value?: string } } }>
    }

    const named: SeriesPart[] = []
    for (const part of parts) {
      const title = labels.entities?.[part.id]?.labels?.en?.value
      if (title) named.push({ ordinal: part.ordinal, title })
    }
    named.sort(
      (a, b) =>
        (a.ordinal ?? Number.POSITIVE_INFINITY) -
        (b.ordinal ?? Number.POSITIVE_INFINITY),
    )
    return { entityLabel: entity.label, parts: named }
  } catch (error) {
    logger.warn(`Wikidata series lookup failed for "${name}": ${String(error)}`)
    return null
  }
}
