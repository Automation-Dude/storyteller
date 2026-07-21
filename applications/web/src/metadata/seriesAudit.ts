import { type UUID } from "@/uuid"

import { seriesFromTitle } from "./localSignals"
import { seriesNamesMatch } from "./titleCleaning"

/**
 * Series-level audit: the same use-every-signal philosophy as book
 * resolution, applied across the shelf. From the library's own data alone it
 * answers two questions per series: which numbered volumes are missing, and
 * which books already in the library belong to the series but were never
 * linked to it. Naming what a missing number IS needs a catalogue and is a
 * separate, on-demand lookup.
 *
 * Pure functions, no I/O; proven by seriesAudit.test.ts.
 */

/** The slice of a library book the series audit reads. */
export type SeriesAuditBook = {
  uuid: UUID
  title: string
  authors: { name: string }[]
  series: { name: string; position: number | null }[]
}

export type SeriesMember = {
  uuid: UUID
  title: string
  position: number | null
}

export type UnlinkedMember = SeriesMember & {
  /** The series name exactly as the clue wrote it, for the repair to apply. */
  clueName: string
}

export type SeriesReport = {
  name: string
  /** Books linked to the series, sorted by position (null positions last). */
  members: SeriesMember[]
  /** Books in the library whose own title names this series but that are not
   * linked to it; each is a one-click link proposal. */
  unlinked: UnlinkedMember[]
  /** Integer positions the library has (linked members). */
  havePositions: number[]
  /** Integer positions missing between 1 and the highest owned position.
   * Empty for single-member series, where a lone high number says nothing. */
  missingPositions: number[]
  /** The most common author among members, as a hint for catalogue lookups. */
  authorHint: string | null
}

function integerPositions(values: (number | null)[]): number[] {
  const out = new Set<number>()
  for (const value of values) {
    if (value !== null && Number.isInteger(value) && value > 0) out.add(value)
  }
  return [...out].sort((a, b) => a - b)
}

/**
 * Audit every series in the library. Only series with something to say
 * (a gap or an unlinked member) are worth showing, but all are returned;
 * the caller filters for display so the counts stay honest.
 */
export function auditSeries(books: SeriesAuditBook[]): SeriesReport[] {
  // Group linked members by series, case-insensitively, keeping the first
  // display casing seen.
  const byKey = new Map<
    string,
    { name: string; members: SeriesMember[]; authors: Map<string, number> }
  >()
  for (const book of books) {
    for (const relation of book.series) {
      const key = relation.name.trim().toLowerCase()
      if (!key) continue
      let group = byKey.get(key)
      if (!group) {
        group = { name: relation.name.trim(), members: [], authors: new Map() }
        byKey.set(key, group)
      }
      // A linked row without a position often still shows its number in the
      // title ("Wintersteel (Cradle Book 8)"); read it rather than lose it.
      const clue = seriesFromTitle(book.title)
      const position =
        relation.position ??
        (clue && seriesNamesMatch(clue.name, relation.name)
          ? clue.position
          : null)
      group.members.push({ uuid: book.uuid, title: book.title, position })
      for (const author of book.authors) {
        group.authors.set(
          author.name,
          (group.authors.get(author.name) ?? 0) + 1,
        )
      }
    }
  }

  // Books whose own title names a series they are not linked to.
  const unlinkedByKey = new Map<string, UnlinkedMember[]>()
  for (const book of books) {
    const clue = seriesFromTitle(book.title)
    if (!clue) continue
    for (const [key, group] of byKey) {
      if (!seriesNamesMatch(clue.name, group.name)) continue
      if (book.series.some((s) => s.name.trim().toLowerCase() === key)) continue
      const list = unlinkedByKey.get(key) ?? []
      list.push({
        uuid: book.uuid,
        title: book.title,
        position: clue.position,
        clueName: group.name,
      })
      unlinkedByKey.set(key, list)
      break
    }
  }

  const reports: SeriesReport[] = []
  for (const [key, group] of byKey) {
    const members = group.members
      .slice()
      .sort(
        (a, b) =>
          (a.position ?? Number.POSITIVE_INFINITY) -
          (b.position ?? Number.POSITIVE_INFINITY),
      )
    const havePositions = integerPositions(members.map((m) => m.position))
    const highest = havePositions[havePositions.length - 1] ?? 0
    // A lone volume numbered 40 says nothing about wanting 1 through 39;
    // gaps only mean something once the shelf holds more than one volume.
    const missingPositions =
      members.length >= 2 && highest >= 2
        ? Array.from({ length: highest }, (_, i) => i + 1).filter(
            (n) => !havePositions.includes(n),
          )
        : []
    let authorHint: string | null = null
    let bestCount = 0
    for (const [name, count] of group.authors) {
      if (count > bestCount) {
        authorHint = name
        bestCount = count
      }
    }
    reports.push({
      name: group.name,
      members,
      unlinked: unlinkedByKey.get(key) ?? [],
      havePositions,
      missingPositions,
      authorHint,
    })
  }
  return reports.sort((a, b) => a.name.localeCompare(b.name))
}
