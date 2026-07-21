/**
 * Turn an ingestion-mangled title into something a metadata search can match,
 * and score how well a search result matches back.
 *
 * The library is full of titles that are really filenames: "02 - Dune - Frank
 * Herbert - 1965", "DP19 - Treasure of Khan", "Hobb - Liveship Traders - Book
 * 01 - Ship of Magic", "ISniperUnabridgedPart1_mp332_gpoteet", even a whole
 * Amazon URL. Perfectly parsing every one is hopeless; instead we strip the
 * obvious junk to get a decent search string, and lean on the search engine's
 * fuzziness plus the author we may already have in the database to pick the
 * right book from the results.
 */

import { seriesPrefixTitle } from "./localSignals"

/** Junk segments that are never part of a real title. */
const JUNK_SEGMENT =
  /^(?:\d+|book\s*\d+|vol(?:ume)?\.?\s*\d+|d\d{1,2}|dp\d{1,2}|cd\d+|disc\s*\d+|part\s*\d+|(?:19|20)\d{2}|unabridged|abridged)$/i

/** Noise that clings to a title anywhere in the string. */
const INLINE_NOISE: RegExp[] = [
  /https?:\/\/\S+/gi, // a URL where a title should be
  /\|[a-z]+\|/gi, // store markers like "|adbl|"
  /\[[A-Za-z0-9]{5,}\]/g, // hash suffixes like "[A85UyqsZ]"
  /\((?:un)?abridged\)/gi,
  /\(full[- ]?cast(?:\s+edition)?\)/gi,
  /\bunabridged\b/gi,
  /\b(?:cd|disc|disk)\s*\d+\b/gi,
  /\bpart\s*\d+\b/gi,
  // A year only counts as noise when it is set off in parens, e.g. "(1965)".
  // A bare 4-digit run is left alone so titles like "1984" or "2001" survive.
  /\((?:19|20)\d{2}\)/g,
  /_mp3\d*/gi,
  /\.(?:mp3|m4b|m4a|epub|kepub|mobi|azw3|pdf)\b/gi,
  /\bepub\d?\b/gi,
]

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

/**
 * A clean-ish search string for a raw title.
 *
 * Underscores become spaces, known noise is removed, and segments split on
 * " - " that are pure numbers, catalogue codes, "Book 3", years, and the like
 * are dropped. What remains is joined back with spaces: not necessarily a
 * perfect title, but a good query.
 */
export function normalizeForSearch(rawTitle: string): string {
  let value = rawTitle.replace(/_/g, " ")
  // A leading track/disc/catalogue number: "08 ", "02 - ", "DP19 - ", "cd01-".
  value = value.replace(/^\s*(?:\d{1,3}|[a-z]{1,3}\d{1,3})[\s.\-_]+/i, "")
  // Series / volume suffixes dilute a title match: a parenthetical "(Cradle
  // Book 9)", a colon-form "A Clash of Kings: A Song of Ice and Fire, Book II",
  // or a trailing "..., Book 4". Only a real volume marker (book/vol/part +
  // number, Arabic or Roman) triggers it, so "2001: A Space Odyssey" survives.
  value = value.replace(
    /\s*[([][^)\]]*\b(?:book|bk\.?|vol(?:ume)?|part)\s*(?:\d+|[ivxlcdm]{1,7})[^)\]]*[)\]]/gi,
    " ",
  )
  value = value.replace(
    /\s*:\s*.*\b(?:book|bk\.?|vol(?:ume)?|part)\s*(?:\d+|[ivxlcdm]{1,7})\b.*$/i,
    "",
  )
  value = value.replace(
    /\s*,?\s*\b(?:book|bk\.?|vol(?:ume)?|part)\s*(?:\d+|[ivxlcdm]{1,7})\b\.?\s*$/i,
    "",
  )
  for (const noise of INLINE_NOISE) value = value.replace(noise, " ")
  // Empty brackets left where noise used to be: "The Hobbit ( )".
  value = value.replace(/\(\s*\)|\[\s*\]/g, " ")

  const segments = value
    .split(/\s+-\s+|\s+[–—]\s+/)
    .map((segment) => collapseWhitespace(segment))
    .filter(Boolean)
  const kept = segments.filter((segment) => !JUNK_SEGMENT.test(segment))

  // If dropping junk segments removed everything, the "junk" was the title
  // itself (a book really called "1984"), so keep what we had.
  const result = kept.length ? kept : segments

  // Trim any dashes or stray punctuation left at the ends.
  return collapseWhitespace(result.join(" ")).replace(
    /^[\s\-–—.[\]]+|[\s\-–—.[\]]+$/g,
    "",
  )
}

/**
 * The queries worth trying for a title, most faithful first.
 *
 * A stored title often buries the real one under series clutter:
 * "Raising Steam: (Discworld novel 40) (Discworld series)". The full form
 * matches nothing well; the form with parentheticals and series suffixes
 * stripped matches exactly. Searching is cheap, so the resolver walks these
 * until a match is confident.
 */
export function queryVariants(rawTitle: string): string[] {
  const variants: string[] = []
  const push = (value: string) => {
    const query = normalizeForSearch(value)
    if (query && !variants.includes(query)) variants.push(query)
  }
  push(rawTitle)
  push(rawTitle.replace(/\s*[([][^)\]]*[)\]]/g, " "))
  // Colon-form subtitle clutter: "Title: A Novel of the Something Saga".
  const beforeColon = rawTitle.split(":")[0]
  if (beforeColon && beforeColon.trim().split(/\s+/).length >= 2) {
    push(beforeColon)
  }
  // "Artemis Fowl 07 - The Atlantis Complex" only matches under its real title.
  const bare = seriesPrefixTitle(rawTitle)
  if (bare) push(bare)
  return variants
}

/** Lowercase, drop punctuation and articles, for comparing two titles. */
export function normalizeForCompare(value: string): string {
  return collapseWhitespace(
    value
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/^(the|a|an)\s+/, ""),
  )
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeForCompare(value).split(" ").filter(Boolean))
}

/** Jaccard overlap of the words in two strings, 0 to 1. */
export function titleSimilarity(a: string, b: string): number {
  const setA = tokenSet(a)
  const setB = tokenSet(b)
  if (setA.size === 0 || setB.size === 0) return 0
  let shared = 0
  for (const token of setA) if (setB.has(token)) shared++
  return shared / (setA.size + setB.size - shared)
}

/**
 * Title similarity that is not fooled by a series parenthetical on the
 * candidate. A canonical work is often catalogued as "The Diamond Throne (The
 * Elenium)"; comparing its base title too lets it match a stored "The Diamond
 * Throne" exactly, so it is not beaten by a bare-title one-edition ghost.
 * Taking the max means the strip can only ever help.
 */
export function bestTitleSimilarity(
  candidateTitle: string,
  queryTitle: string,
): number {
  const base = candidateTitle.replace(/\s*[([][^)\]]*[)\]]/g, " ")
  return Math.max(
    titleSimilarity(candidateTitle, queryTitle),
    titleSimilarity(base, queryTitle),
  )
}

/** True if two author strings plausibly name the same person. */
export function authorsMatch(a: string, b: string): boolean {
  const setA = tokenSet(a.replace(/^by\s+/i, ""))
  const setB = tokenSet(b.replace(/^by\s+/i, ""))
  if (setA.size === 0 || setB.size === 0) return false
  // A surname in common is enough: "Cornwell" vs "Bernard Cornwell".
  for (const token of setA) {
    if (token.length > 2 && setB.has(token)) return true
  }
  return false
}

/** Titles that signal a result is not the book itself. */
const NOT_THE_BOOK =
  /\b(adaptation|study guide|summary|analysis|sparknotes|cliffsnotes|workbook|companion|boxed set|box set)\b/i

export type MatchInput = {
  title: string
  authorNames: string[]
  editionCount: number
  /** How many Open Library ratings the work has; 0 when unknown. */
  ratingsCount?: number
}

/**
 * How well a search result matches what we were looking for, 0 (no) to 1 (yes).
 *
 * Title overlap carries most of the weight; a matching author adds a lot of
 * confidence, since it is the thing least likely to coincide by accident. A
 * result with many editions is more likely the canonical work than a one-off,
 * and titles that read like a study guide are pushed down.
 */
export function scoreMatch(
  candidate: MatchInput,
  queryTitle: string,
  queryAuthor?: string,
): number {
  const titleScore = bestTitleSimilarity(candidate.title, queryTitle)

  let authorScore = 0
  if (queryAuthor) {
    authorScore = candidate.authorNames.some((name) =>
      authorsMatch(name, queryAuthor),
    )
      ? 1
      : -0.15 // we asked for an author and none matched: mild doubt
  }

  // Canonical works accumulate editions; log so 5 vs 50 matters, 500 vs 550 not.
  const editionScore = Math.min(Math.log10(candidate.editionCount + 1) / 2, 1)

  // Readers rate the real book, not an orphaned catalogue double; a small
  // nudge so the popular work outranks a same-title ghost record.
  const ratingsScore = Math.min(
    Math.log10((candidate.ratingsCount ?? 0) + 1) / 2,
    1,
  )

  // An omnibus / box set lists several works in one title ("A / B / C / D"); it
  // is not the single book we are resolving, so push it well down.
  const isCompilation = (candidate.title.match(/\s\/\s/g) ?? []).length >= 2
  const penalty =
    (NOT_THE_BOOK.test(candidate.title) ? 0.4 : 0) + (isCompilation ? 0.4 : 0)

  const score =
    titleScore * 0.6 +
    authorScore * 0.25 +
    editionScore * 0.1 +
    ratingsScore * 0.05 -
    penalty

  return Math.max(0, Math.min(1, score))
}
