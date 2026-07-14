import {
  FlatList,
  RefreshControl,
  View,
  useWindowDimensions,
} from "react-native"

import { type BookWithRelations } from "@/database/books"
import { useBookFilters } from "@/hooks/useBookFilters"
import { useListAllServerBooks } from "@/hooks/useListAllServerBooks"

import { BackButton } from "./BackButton"
import { BookFilterSort } from "./BookFilterSort"
import { BookThumbnail } from "./BookThumbnail"
import { MiniPlayerWidget } from "./MiniPlayerWidget"
import { Stack } from "./ui/Stack"
import { Text } from "./ui/text"

interface Props {
  title: string
  books: BookWithRelations[]
  // Shelves like "Currently reading" are already a curated order; filtering
  // them would fight the shelf's own meaning.
  filterable?: boolean
}

export function BookGrid({ title, books, filterable = true }: Props) {
  const dimensions = useWindowDimensions()

  const { isLoading, refetch } = useListAllServerBooks()

  const {
    filters,
    setFilters,
    sort,
    setSort,
    facets,
    filteredBooks,
    activeCount,
    clear,
  } = useBookFilters(books)

  const shownBooks = filterable ? filteredBooks : books

  const horizontalPadding = 32
  const gap = 12
  const minThumbnailWidth = 150

  const numColumns = Math.max(
    1,
    Math.floor(
      (dimensions.width - horizontalPadding + gap) / (minThumbnailWidth + gap),
    ),
  )

  const thumbnailWidth = Math.floor(
    (dimensions.width - horizontalPadding - (numColumns - 1) * gap) /
      numColumns,
  )

  return (
    <Stack className="pt-safe flex-1 items-stretch">
      <View className="w-full flex-row items-center justify-start gap-2 self-start px-2">
        <BackButton />

        <Text className="font-youngserif my-2" variant="h3">
          {title}
        </Text>

        <Text className="text-muted-foreground mr-4 ml-auto text-sm">
          {shownBooks.length} books
        </Text>
      </View>

      {filterable && (
        <BookFilterSort
          filters={filters}
          setFilters={setFilters}
          sort={sort}
          setSort={setSort}
          facets={facets}
          activeCount={activeCount}
          clear={clear}
        />
      )}

      <FlatList
        key={numColumns}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              refetch()
            }}
          />
        }
        className="px-4"
        data={shownBooks}
        numColumns={numColumns}
        {...(numColumns > 1 && { columnWrapperStyle: { gap } })}
        renderItem={({ item: book }) => (
          <View className="my-2" style={{ width: thumbnailWidth }}>
            <BookThumbnail book={book} width={thumbnailWidth} />
          </View>
        )}
        ListEmptyComponent={
          activeCount > 0 ? (
            <Text className="text-muted-foreground mt-8 text-center text-sm">
              No books match these filters.
            </Text>
          ) : null
        }
        ListFooterComponent={<View className="h-40 w-full" />}
      />
      <MiniPlayerWidget />
    </Stack>
  )
}
