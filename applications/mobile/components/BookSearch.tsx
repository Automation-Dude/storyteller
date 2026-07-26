import { type TriggerRef } from "@rn-primitives/dropdown-menu"
import { Link } from "expo-router"
import { useRef, useState } from "react"
import { useWindowDimensions } from "react-native"
import { FlatList } from "react-native-gesture-handler"

import { useBookSearch } from "@/hooks/useBookSearch"

import { BookThumbnailImage } from "./BookThumbnail"
import { Group } from "./ui/Group"
import { Stack } from "./ui/Stack"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Input } from "./ui/input"
import { Text } from "./ui/text"

// The dropdown is a quick jump-to, not the full results view; anything past
// this many matches is reachable through the "See all results" screen.
const MAX_DROPDOWN_RESULTS = 8

export function BookSearch() {
  const triggerRef = useRef<TriggerRef | null>(null)
  const [query, setQuery] = useState("")

  const filteredBooks = useBookSearch(query)

  const [width, setWidth] = useState(0)
  const { height: windowHeight } = useWindowDimensions()

  return (
    <DropdownMenu className="grow">
      <DropdownMenuTrigger
        ref={triggerRef}
        onLayout={({
          nativeEvent: {
            layout: { width },
          },
        }) => {
          setWidth(width)
        }}
        asChild
      >
        <Input
          className="min-h-8 text-sm"
          accessibilityLabel="Search books"
          maxFontSizeMultiplier={2}
          value={query}
          onChangeText={(value) => {
            if (!value) {
              triggerRef.current?.close()
            } else {
              triggerRef.current?.open()
            }
            setQuery(value)
          }}
          placeholder="Search"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="mt-2"
        style={{
          width,
        }}
      >
        {query && !!filteredBooks.length && (
          <FlatList
            data={filteredBooks.slice(0, MAX_DROPDOWN_RESULTS)}
            // Without a bounded height the list grows to its intrinsic size,
            // pushes the dropdown past the top of the screen, and cannot
            // scroll. Bounding it keeps every row reachable.
            style={{ maxHeight: windowHeight * 0.45 }}
            renderItem={({ item: book }) => (
              <DropdownMenuItem asChild>
                <Link
                  className="active:bg-secondary"
                  href={{
                    pathname: "/book/[uuid]",
                    params: { uuid: book.uuid },
                  }}
                  onPress={() => {
                    triggerRef.current?.close()
                    setQuery("")
                  }}
                >
                  <Group className="gap-4" style={{ width }}>
                    <BookThumbnailImage height={64} width={42} book={book} />
                    <Stack className="shrink">
                      <Text numberOfLines={2} className="text-sm font-semibold">
                        {book.title}
                      </Text>
                      <Text numberOfLines={1} className="text-sm">
                        {book.authors[0]?.name}
                      </Text>
                    </Stack>
                  </Group>
                </Link>
              </DropdownMenuItem>
            )}
          ></FlatList>
        )}
        {query && filteredBooks.length > MAX_DROPDOWN_RESULTS && (
          <DropdownMenuItem asChild>
            <Link
              className="active:bg-secondary"
              href={{
                pathname: "/search",
                params: { query },
              }}
              onPress={() => {
                triggerRef.current?.close()
                setQuery("")
              }}
            >
              <Group className="justify-center py-1" style={{ width }}>
                <Text className="text-sm font-semibold">
                  See all {filteredBooks.length} results
                </Text>
              </Group>
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
