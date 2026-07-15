import { parseAsString, useQueryState } from "nuqs"

export function useBookInSidePanel() {
  const [selectedBookUuid, setSelectedBookUuid] = useQueryState(
    "book",
    parseAsString,
  )

  return { selectedBookUuid, setSelectedBookUuid }
}
