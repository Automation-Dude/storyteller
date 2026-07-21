/**
 * Recover a clean (author, title, series) guess from the messy signals a book
 * already carries: its folder name, its audio file names, and any embedded tags
 * or sidecar metadata. This runs BEFORE any external lookup so that a book with
 * a broken title ("DP15 - Atlantis Found", "18 - Sharpe's Siege") is searched by
 * its real title instead of the junk, and so a language/description/author that
 * is sitting in the book's own files never needs a network call at all.
 *
 * These are pure functions with no I/O; the audit's repair proposer feeds them
 * what it already has (title, folder) and, when available, parsed file metadata.
 * They are covered by localSignals.test.ts against real problematic samples.
 */

const TRACK =
  /^(\d+\s*(of|\/)\s*\d+|\d+|disc\s*\d+.*|cd\s*\d+.*|part\s*\d+.*|pt\.?\s*\d+.*|track\s*\d+.*)$/i
const NAME = /^[A-Z][a-zA-Z.'’]+(?:\s+(?:[A-Z]\.?|[A-Z][a-zA-Z.'’]+)){1,3}$/
const CATALOG = /^[A-Z]{1,4}\d+\s*[-.]?\s*/

/** Parsed metadata a caller may already have read from a book's files. */
export type FileSignals = {
  /** Libation metadata.json: authors[].name, title, language, description. */
  mj?: {
    authors?: string[]
    title?: string
    language?: string
    description?: string
    series?: string
  }
  /** Embedded audio tags (ffprobe): artist, album_artist, album. */
  tags?: { artist?: string; album_artist?: string; album?: string }
  /** epub OPF Dublin Core fields. */
  opf?: { author?: string; title?: string }
}

export type CombinedGuess = {
  author: string | null
  title: string | null
  series: string | null
  seq: string | null
}

function dash(s: string): string[] {
  return (s || "")
    .replace(/_/g, " ")
    .split(/\s+-\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function isName(s: string): boolean {
  return NAME.test((s || "").trim())
}

function stripBy(a: string): string {
  return (a || "")
    .replace(/^\s*(by|written by|read by|author:?)\s+/i, "")
    .trim()
}

function first(...vals: (string | null | undefined)[]): string | null {
  for (const v of vals) if (v?.trim()) return v.trim()
  return null
}

/** Strip catalogue codes, leading track numbers, "Book N", years, disc labels,
 * part/abridged markers, and comma-form series wrappers from a title. */
export function cleanTitle(raw: string | null | undefined): string {
  let t = raw || ""
  // "Camel Club Series Bk. 3, Stone Cold, pt. 1 of 3" -> keep the segment that
  // is neither a series+number nor a part/disc marker (the real title).
  if (t.includes(",")) {
    const parts = t
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
    const keep = parts.filter(
      (p) =>
        !/(series|bk\.?|book|vol\.?|volume)\s*\d+\s*$/i.test(p) &&
        !/^(pt\.?|part|disc|cd|track)\s*\d+/i.test(p),
    )
    if (keep.length > 0 && keep.length < parts.length) {
      t = keep.length === 1 ? keep[0] ?? t : keep.join(", ")
    }
  }
  t = t.replace(CATALOG, "") // "DP15 - "
  t = t.replace(/^\d+(\(\d+\))?[\s.\-)]+/, "") // "12 - ", "2. " (needs a separator; keeps "47th", "2001:")
  t = t.replace(/\s*[-,:]?\s*Book\s*\d+.*$/i, "")
  t = t.replace(/\s*-\s*\d{4}\s*$/, "") // trailing year
  t = t.replace(/,?\s*(pt\.?|part)\s*\d+\s*(of\s*\d+)?\s*$/i, "")
  t = t.replace(/\s*[([]?(un)?abridged[)\]]?\s*$/i, "")
  t = t.replace(/\b(side|disc|disk|cd)\s*\d+.*$/i, "") // "Side 19", "Disc 3..."
  t = t.replace(/\bD\d+[-_\s]?\d*\b.*$/, "") // disc label "D01-11"
  t = t.replace(/(\w+\s+\w+.*?)\s+\d{1,2}$/, "$1") // trailing track num, only after >=2 words
  t = t.replace(/[\s\-–—_]+$/, "")
  return t.replace(/\s+/g, " ").replace(/^[\s\-_]+|[\s\-_]+$/g, "")
}

/**
 * Signals that a stored author name is an ingestion artifact, not a person:
 * a narration credit ("Narrated by William Gaminara"), a "By " prefix,
 * underscores from a filename, or a file-as form ("Cornwell, Bernard") that
 * leaked into the display name.
 */
export function authorNameIsBad(name: string): boolean {
  const n = (name || "").trim()
  if (!n) return true
  if (/^(by|written by|narrated by|read by|performed by)\s+/i.test(n))
    return true
  if (n.includes("_")) return true
  if (/^[A-Z][a-zA-Z.'’]+,\s+[A-Z]/.test(n)) return true // "Cornwell, Bernard"
  if (/https?:|\.com|\d{3,}/.test(n)) return true
  return false
}

/**
 * The person's name recovered from a damaged author string. Deterministic
 * cleanup only: strips credit prefixes, turns underscores into spaces, and
 * un-reverses a single "Last, First" form. Returns the input trimmed when
 * nothing recognizable is wrong.
 */
export function cleanAuthorName(name: string): string {
  let n = (name || "").replace(/_/g, " ").trim()
  n = n.replace(/^(by|written by|narrated by|read by|performed by)\s+/i, "")
  const reversed = /^([A-Z][a-zA-Z.'’]+),\s+([A-Z][a-zA-Z .'’]+)$/.exec(n)
  if (reversed?.[1] && reversed[2]) {
    n = `${reversed[2].trim()} ${reversed[1].trim()}`
  }
  return n.replace(/\s+/g, " ").trim()
}

/** Levenshtein distance, for catching a typo'd author against a trusted one. */
export function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  let previous = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const current = [i]
    for (let j = 1; j <= n; j++) {
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[n] ?? 0
}

export type SeriesGuess = { name: string; position: number | null }

function seriesPosition(raw: string | undefined): number | null {
  if (!raw) return null
  const roman: Record<string, number> = {
    i: 1,
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5,
    vi: 6,
    vii: 7,
    viii: 8,
    ix: 9,
    x: 10,
    xi: 11,
    xii: 12,
    xiii: 13,
    xiv: 14,
    xv: 15,
  }
  const lower = raw.trim().toLowerCase()
  if (lower in roman) return roman[lower] ?? null
  const parsed = Number.parseFloat(lower)
  return Number.isFinite(parsed) ? parsed : null
}

const SERIES_NOISE = /^(the\s+)?(complete|boxed?\s*set|collection|omnibus)\b/i

function cleanSeriesName(raw: string): string | null {
  const name = raw
    .replace(/\s*[([]$/, "")
    .replace(/\s*(series|saga|trilogy|novels?)\s*$/i, "")
    .replace(/[\s\-–—:,]+$/, "")
    .trim()
  if (name.length < 3 || SERIES_NOISE.test(name)) return null
  if (!/[A-Za-z]{3,}/.test(name)) return null
  return name
}

/**
 * A series wrapped inside the title itself, in the forms the library actually
 * contains:
 *   "Wintersteel (Cradle Book 8)"            parenthetical
 *   "A Clash of Kings: A Song of Ice and Fire, Book II"   colon form
 *   "Dead Zero - Bob Lee Swagger Series, Book 7"          dash form
 *   "The Fires of Heaven: Book Five of The Wheel of Time" inverted form
 */
export function seriesFromTitle(rawTitle: string): SeriesGuess | null {
  const t = (rawTitle || "").trim()
  if (!t) return null

  // "Book Five of The Wheel of Time" / "Book 5 of the Stormlight Archive"
  const inverted =
    /\b(?:book|volume|vol\.?)\s+([a-z]+|\d+(?:\.\d+)?)\s+(?:of|in)\s+(.{3,60}?)\s*$/i.exec(
      t,
    )
  if (inverted?.[2]) {
    const words: Record<string, string> = {
      one: "1",
      two: "2",
      three: "3",
      four: "4",
      five: "5",
      six: "6",
      seven: "7",
      eight: "8",
      nine: "9",
      ten: "10",
      eleven: "11",
      twelve: "12",
      thirteen: "13",
      fourteen: "14",
    }
    const numeric = words[(inverted[1] ?? "").toLowerCase()] ?? inverted[1]
    const name = cleanSeriesName(inverted[2])
    if (name) return { name, position: seriesPosition(numeric) }
  }

  // "(Cradle Book 8)" / "[The Expanse, Book 4]" / "(Mars Trilogy Book 3)"
  const wrapped =
    /[([]([^()[\]]{3,60}?)[\s,]+(?:book|bk\.?|volume|vol\.?|#)\s*([a-z]+|\d+(?:\.\d+)?)[^()[\]]*[)\]]/i.exec(
      t,
    )
  if (wrapped?.[1]) {
    const name = cleanSeriesName(wrapped[1])
    if (name) return { name, position: seriesPosition(wrapped[2]) }
  }

  // ": A Song of Ice and Fire, Book II" / " - Bob Lee Swagger Series, Book 7"
  const suffix =
    /[:\-–—]\s*([^:\-–—]{3,60}?)[\s,]+(?:book|bk\.?|volume|vol\.?|#)\s*([a-z]+|\d+(?:\.\d+)?)\s*$/i.exec(
      t,
    )
  if (suffix?.[1]) {
    const name = cleanSeriesName(suffix[1])
    if (name) return { name, position: seriesPosition(suffix[2]) }
  }

  // "Artemis Fowl 07 - The Atlantis Complex" / "Discworld 40 - Raising Steam":
  // the ripped-audiobook folder form, series then a small number then the real
  // title. Requires the trailing " - Title" so a bare "Catch 22" is left alone.
  const leading = LEADING_SERIES.exec(t)
  if (leading?.[1] && leading[3]) {
    const name = cleanSeriesName(leading[1])
    if (name) return { name, position: seriesPosition(leading[2]) }
  }

  return null
}

// Leading "<Series> <n> - <Title>" with a letter in both the series and the
// title, and a position of at most two digits so a year cannot pose as one.
const LEADING_SERIES =
  /^([^\d].*?[a-z].*?)\s+(\d{1,2})\s*[-–—.]\s+(.*[a-z].*)$/i

/**
 * The real title hiding in a "<Series> <n> - <Title>" folder name, or null.
 * Lets the catalogue search look up "The Atlantis Complex" instead of
 * "Artemis Fowl 07 The Atlantis Complex", which matches nothing.
 */
export function seriesPrefixTitle(rawTitle: string): string | null {
  const match = LEADING_SERIES.exec((rawTitle || "").trim())
  return match?.[3] ? match[3].trim() : null
}

/** A title is junk if it is a bare disc/track/catalogue label with no real word. */
export function isGarbageTitle(t: string | null | undefined): boolean {
  const s = (t || "").trim()
  if (s.length < 3) return true
  if (/^(side|disc|disk|cd|track|part|pt|vol)\.?\s*\d+/i.test(s)) return true
  if (/^[A-Z]{1,4}[-_\s]?\d+([-_\s]?\d+)?$/.test(s)) return true
  if (!/[A-Za-z]{3,}/.test(s)) return true
  return false
}

function fromFilename(fname: string | undefined): {
  author: string | null
  title: string | null
} {
  const base = (fname || "").replace(/\.[^.]+$/, "")
  const segs = dash(base)
  while (segs.length && TRACK.test(segs[segs.length - 1] ?? "")) segs.pop()
  const head = segs[0]
  if (segs.length >= 2 && head !== undefined && isName(head)) {
    return { author: head, title: cleanTitle(segs.slice(1).join(" - ")) }
  }
  return {
    author: null,
    title: segs.length ? cleanTitle(segs.join(" - ")) : null,
  }
}

function fromFolder(name: string): {
  author: string | null
  series: string | null
  seq: string | null
  title: string | null
} {
  const segs = dash(name)
  let author: string | null = null
  let series: string | null = null
  let seq: string | null = null
  let title: string | null = null
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i] ?? ""
    const bm = /(?:Book|Bk\.?|#)\s*(\d+)/i.exec(s)
    if (bm) {
      seq = bm[1] ?? null
      const pre = s.slice(0, bm.index).replace(/^[\s\-,]+|[\s\-,]+$/g, "")
      const prev = i >= 1 ? segs[i - 1] ?? null : null
      if (i + 1 < segs.length) {
        title = segs.slice(i + 1).join(" - ") // "Author - Series - Book N - Title"
        series = pre || prev
        if (i >= 2 && !pre) author = segs[0] ?? null
      } else {
        series = pre || prev
        title = i >= 1 ? segs.slice(0, i).join(" - ") : pre // "Title - Series Book N"
      }
      break
    }
  }
  if (!title) {
    const s2 = segs.slice()
    let hadYear = false
    if (s2.length && /^([A-Z]{1,4})?\d+(\(\d+\))?$/.test(s2[0] ?? ""))
      s2.shift()
    if (s2.length && /^\d{4}$/.test(s2[s2.length - 1] ?? "")) {
      s2.pop()
      hadYear = true
    }
    const firstSeg = s2[0]
    const lastSeg = s2[s2.length - 1]
    // A trailing year marks "Title - Author - YYYY", so the name is the author
    // even when the title is itself title-cased ("The Time Machine").
    if (
      s2.length >= 2 &&
      lastSeg !== undefined &&
      isName(lastSeg) &&
      (hadYear || (firstSeg !== undefined && !isName(firstSeg)))
    ) {
      author = lastSeg
      title = s2.slice(0, -1).join(" - ")
    } else if (s2.length >= 2 && firstSeg !== undefined && isName(firstSeg)) {
      author = firstSeg
      title = s2.slice(1).join(" - ")
    } else {
      title = s2.join(" - ")
    }
  }
  return {
    author: author ? stripBy(author) : null,
    series,
    seq,
    title: cleanTitle(title || ""),
  }
}

function pickTitle(
  candidates: (string | null | undefined)[],
  fallback: string,
): string {
  for (const c of candidates) {
    const ct = cleanTitle(c)
    if (ct && !isGarbageTitle(ct)) return ct
  }
  return cleanTitle(fallback)
}

/**
 * Merge every available signal into one guess. Precedence: explicit metadata
 * (json/opf) beats the parsed folder, which beats a per-track filename/tag,
 * which beats the raw title. Junk candidates are skipped, not trusted.
 */
export function combine(
  dbTitle: string,
  assetDir: string | null | undefined,
  filename?: string,
  signals: FileSignals = {},
): CombinedGuess {
  const { mj = {}, tags = {}, opf = {} } = signals
  const ff = fromFilename(filename)
  const fd = fromFolder(assetDir || "")
  const author = first(
    (mj.authors || []).filter(Boolean).join("; "),
    stripBy(tags.artist || tags.album_artist || ""),
    opf.author,
    ff.author,
    fd.author,
  )
  const album = tags.album && !TRACK.test(tags.album) ? tags.album : null
  const title = pickTitle(
    [mj.title, opf.title, fd.title, ff.title, album],
    dbTitle,
  )
  const series = first(
    typeof mj.series === "string" ? mj.series : null,
    fd.series,
  )
  return { author, title, series, seq: fd.seq }
}
