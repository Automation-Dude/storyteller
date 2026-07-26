import { useLocalSearchParams } from "expo-router"

import { BookGrid } from "@/components/BookGrid"
import { useBookSearch } from "@/hooks/useBookSearch"

export default function SearchScreen() {
  const { query } = useLocalSearchParams() as { query?: string }

  const results = useBookSearch(query ?? "")

  return <BookGrid title={`Search: ${query ?? ""}`} books={results} />
}
