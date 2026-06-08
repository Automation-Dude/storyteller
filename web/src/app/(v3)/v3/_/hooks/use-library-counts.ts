import { useGetLibraryCountsQuery } from "@/store/api"

export type CountResult = {
  count: number | undefined
  isLoading: boolean
}

export type LibraryCounts = Record<string, CountResult>

/**
 * library facet + entity counts, computed on the server in a single request.
 * the facet counts (series, authors, tags, ...) badge the builtin sidebar
 * entries; the per-entity counts are exposed under `collection:<uuid>` and
 * `shelf:<uuid>` keys so collection and shelf sidebar rows can badge too.
 */
export function useLibraryCounts(): LibraryCounts {
  const { data, isLoading } = useGetLibraryCountsQuery()

  const facetKeys = [
    "series",
    "authors",
    "narrators",
    "translators",
    "tags",
    "statuses",
    "publicationYears",
    "ratings",
  ] as const

  const result: LibraryCounts = {}

  for (const key of facetKeys) {
    result[key] = { count: data?.[key], isLoading }
  }

  for (const [uuid, count] of Object.entries(data?.collections ?? {})) {
    result[`collection:${uuid}`] = { count, isLoading }
  }

  console.log("data?.shelves", data?.shelves)

  for (const [uuid, count] of Object.entries(data?.shelves ?? {})) {
    result[`shelf:${uuid}`] = { count, isLoading }
  }

  return result
}
