import { getBooks, updateBook } from "@/database/books"
import {
  getAuthorCreatorsWithCounts,
  getBookUuidsByCreators,
} from "@/database/creators"
import { logger } from "@/logging"
import { type UUID } from "@/uuid"

import { editDistance } from "./localSignals"
import { searchOpenLibrary } from "./openLibrary"
import { authorsMatch } from "./titleCleaning"

/**
 * Creator-level repair: find near-identical author spellings across the whole
 * library ("Anne McCaffery" / "Anne McCaffrey") and let the catalogue decide
 * which spelling is real. Per-book repair can never see this class: each book
 * looks internally consistent, the damage only shows across creators.
 */

export type CreatorCluster = {
  /** The variant spellings found, with how many books each carries. */
  variants: { uuid: UUID; name: string; bookCount: number }[]
  /** The catalogue-confirmed spelling, when one variant could be confirmed. */
  canonical: string | null
}

function clusterKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "")
}

/**
 * Group creators whose names are within a couple of keystrokes of each other.
 * Exact-normalized duplicates ("J.K. Rowling" / "J. K. Rowling") cluster too.
 */
export async function findCreatorClusters(): Promise<CreatorCluster[]> {
  const creators = await getAuthorCreatorsWithCounts()
  const used = new Set<UUID>()
  const clusters: CreatorCluster[] = []
  for (let i = 0; i < creators.length; i++) {
    const a = creators[i]
    if (!a || used.has(a.uuid)) continue
    const members = [a]
    for (let j = i + 1; j < creators.length; j++) {
      const b = creators[j]
      if (!b || used.has(b.uuid)) continue
      const ka = clusterKey(a.name)
      const kb = clusterKey(b.name)
      if (ka === kb || (ka.length >= 8 && editDistance(ka, kb) <= 2)) {
        members.push(b)
      }
    }
    if (members.length < 2) continue
    for (const m of members) used.add(m.uuid)
    clusters.push({
      variants: members.map((m) => ({
        uuid: m.uuid,
        name: m.name,
        bookCount: m.bookCount,
      })),
      canonical: null,
    })
  }
  return clusters
}

/**
 * Ask the catalogue which spelling is real: search a few of the cluster's
 * books and keep the author spelling the confident matches use. No confirmed
 * spelling means no verdict, and the cluster is left for a person.
 */
export async function confirmClusterCanonical(
  cluster: CreatorCluster,
): Promise<string | null> {
  const sampleUuids = await getBookUuidsByCreators(
    cluster.variants.map((v) => v.uuid),
    3,
  )
  const sample = await getBooks(sampleUuids)
  for (const book of sample) {
    const [best] = await searchOpenLibrary(book.title)
    if (!best || best.score < 0.6) continue
    for (const matchedAuthor of best.authors) {
      if (
        cluster.variants.some((v) => authorsMatch(v.name, matchedAuthor)) &&
        cluster.variants.some(
          (v) => v.name.toLowerCase() === matchedAuthor.toLowerCase(),
        )
      ) {
        return matchedAuthor
      }
    }
  }
  return null
}

/**
 * Move every book on the cluster's wrong spellings to the canonical one.
 * updateBook reuses the existing creator row for the canonical name and the
 * orphaned variants stop appearing once nothing references them.
 */
export async function mergeCluster(
  cluster: CreatorCluster,
  canonical: string,
): Promise<number> {
  let moved = 0
  const wrong = cluster.variants.filter(
    (v) => v.name.toLowerCase() !== canonical.toLowerCase(),
  )
  const bookUuids = await getBookUuidsByCreators(
    wrong.map((v) => v.uuid),
    1000,
  )
  const books = await getBooks(bookUuids)
  for (const book of books) {
    const authors = book.authors.map((a) =>
      wrong.some((v) => v.name === a.name)
        ? { name: canonical, fileAs: canonical, role: "aut" as const }
        : { name: a.name, fileAs: a.fileAs || a.name, role: "aut" as const },
    )
    const others = book.creators
      .filter((c) => c.role !== "aut")
      .map((c) => ({
        name: c.name,
        fileAs: c.fileAs || c.name,
        role: c.role || "oth",
      }))
    try {
      await updateBook(book.uuid, null, { creators: [...others, ...authors] })
      moved++
    } catch (error) {
      logger.warn(
        `creator merge failed for ${book.uuid}: ${String(error)}`,
      )
    }
  }
  return moved
}
