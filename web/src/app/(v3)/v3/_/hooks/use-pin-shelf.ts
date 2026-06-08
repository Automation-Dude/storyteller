"use client"

import { useCallback } from "react"
import { toast } from "sonner"

import { type ShelfFilterNode } from "@/shelves"
import {
  useCreateUserShelfMutation,
  useListSidebarQuery,
  useSetSidebarMutation,
} from "@/store/api"

// create a filter-based shelf and pin it to the app sidebar in one go. used by
// the library views to turn any facet (an author, a tag, a series, ...) into a
// saved shelf with a single click.
export function usePinShelf() {
  const [createShelf, { isLoading: isCreating }] = useCreateUserShelfMutation()
  const [setSidebar, { isLoading: isSaving }] = useSetSidebarMutation()
  const { data: sidebarItems = [] } = useListSidebarQuery()

  const pinShelf = useCallback(
    async (name: string, filter: ShelfFilterNode) => {
      try {
        const shelf = await createShelf({
          name,
          description: null,
          filter,
          orderBy: "createdAt",
          orderDirection: "desc",
          limitCount: null,
          books: [],
        }).unwrap()

        await setSidebar([
          ...sidebarItems.map((i) => ({
            kind: i.kind,
            builtinKey: i.builtinKey,
            collectionUuid: i.collectionUuid,
            shelfUuid: i.shelfUuid,
            hidden: i.hidden,
          })),
          { kind: "shelf" as const, shelfUuid: shelf.uuid },
        ]).unwrap()

        toast.success(`Pinned "${name}" to the sidebar`)
      } catch {
        toast.error("Failed to pin shelf")
      }
    },
    [createShelf, setSidebar, sidebarItems],
  )

  return { pinShelf, isPinning: isCreating || isSaving }
}
