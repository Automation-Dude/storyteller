import {
  useListAuthorsQuery,
  useListBooksQuery,
  useListNarratorsQuery,
  useListSeriesQuery,
  useListStatusesQuery,
  useListTagsQuery,
  useListTranslatorsQuery,
} from "@/store/api"

export type CountResult = {
  count: number | undefined
  isLoading: boolean
}

export type LibraryCounts = Record<string, CountResult>

/**
 * subscribes to each list query with `selectFromResult` so the consumer
 * only re-renders when the actual count value changes, not when list
 * contents are modified. publication year and rating counts are derived
 * from the already-cached books list in a single selector call.
 */
export function useLibraryCounts(): LibraryCounts {
  const { count: seriesCount, isLoading: seriesLoading } =
    useListSeriesQuery(undefined, {
      selectFromResult: ({ data, isLoading }) => ({
        count: data?.length,
        isLoading,
      }),
    })

  const { count: authorsCount, isLoading: authorsLoading } =
    useListAuthorsQuery(undefined, {
      selectFromResult: ({ data, isLoading }) => ({
        count: data?.length,
        isLoading,
      }),
    })

  const { count: narratorsCount, isLoading: narratorsLoading } =
    useListNarratorsQuery(undefined, {
      selectFromResult: ({ data, isLoading }) => ({
        count: data?.length,
        isLoading,
      }),
    })

  const { count: translatorsCount, isLoading: translatorsLoading } =
    useListTranslatorsQuery(undefined, {
      selectFromResult: ({ data, isLoading }) => ({
        count: data?.length,
        isLoading,
      }),
    })

  const { count: tagsCount, isLoading: tagsLoading } = useListTagsQuery(
    undefined,
    {
      selectFromResult: ({ data, isLoading }) => ({
        count: data?.length,
        isLoading,
      }),
    },
  )

  const { count: statusesCount, isLoading: statusesLoading } =
    useListStatusesQuery(undefined, {
      selectFromResult: ({ data, isLoading }) => ({
        count: data?.length,
        isLoading,
      }),
    })

  const { publicationYearsCount, ratingsCount, isLoading: booksLoading } =
    useListBooksQuery(undefined, {
      selectFromResult: ({ data, isLoading }) => {
        if (!data) {
          return {
            publicationYearsCount: undefined as number | undefined,
            ratingsCount: undefined as number | undefined,
            isLoading,
          }
        }

        const years = new Set<string>()
        const ratings = new Set<number>()

        for (const book of data) {
          const year = book.publicationDate?.slice(0, 4)
          if (year) years.add(year)

          if (book.rating != null) ratings.add(book.rating)
        }

        return {
          publicationYearsCount: years.size,
          ratingsCount: ratings.size,
          isLoading,
        }
      },
    })

  return {
    series: { count: seriesCount, isLoading: seriesLoading },
    authors: { count: authorsCount, isLoading: authorsLoading },
    narrators: { count: narratorsCount, isLoading: narratorsLoading },
    translators: { count: translatorsCount, isLoading: translatorsLoading },
    tags: { count: tagsCount, isLoading: tagsLoading },
    statuses: { count: statusesCount, isLoading: statusesLoading },
    publicationYears: {
      count: publicationYearsCount,
      isLoading: booksLoading,
    },
    ratings: { count: ratingsCount, isLoading: booksLoading },
  }
}
