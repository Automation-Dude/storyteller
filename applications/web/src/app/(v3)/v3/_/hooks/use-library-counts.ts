import { useGetLibraryCountsQuery } from "@/store/api"

export type CountResult = {
  count: number | undefined
  isLoading: boolean
}

export type LibraryCounts = Record<string, CountResult>

const NAV_FACET_KEYS = [
  "books",
  "series",
  "authors",
  "narrators",
  "translators",
  "tags",
  "statuses",
  "publicationYears",
  "ratings",
] as const

export function useLibraryCounts(): LibraryCounts {
  const { data, isLoading } = useGetLibraryCountsQuery()

  const result: LibraryCounts = {}

  for (const key of NAV_FACET_KEYS) {
    result[key] = { count: data?.[key], isLoading }
  }

  for (const [uuid, count] of Object.entries(data?.collections ?? {})) {
    result[`collection:${uuid}`] = { count, isLoading }
  }

  for (const [uuid, count] of Object.entries(data?.shelves ?? {})) {
    result[`shelf:${uuid}`] = { count, isLoading }
  }

  return result
}
