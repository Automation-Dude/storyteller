import { useMemo } from "react"

import {
  useAddBooksToCollectionsMutation,
  useAddBooksToSeriesMutation,
  useAddTagsToBooksMutation,
  useRemoveBooksFromCollectionsMutation,
  useRemoveBooksFromSeriesMutation,
  useRemoveTagsFromBooksMutation,
  useUpdateReadingStatusMutation,
} from "@/store/api"
import { type UUID } from "@/uuid"

import { type RelationItem, type RelationSource } from "./use-relation-items"

// the add/remove actions for editing a relation across one or more books. status
// is single-valued (radio): selecting sets it exclusively, there is no remove.
export type RelationEditActions = {
  add: (bookUuids: UUID[], item: RelationItem) => void
  remove: (bookUuids: UUID[], itemUuid: UUID) => void
  singleSelect: boolean
}

export function useRelationEditActions(
  source: RelationSource,
): RelationEditActions {
  const [addTags] = useAddTagsToBooksMutation()
  const [removeTags] = useRemoveTagsFromBooksMutation()
  const [addToCollections] = useAddBooksToCollectionsMutation()
  const [removeFromCollections] = useRemoveBooksFromCollectionsMutation()
  const [addToSeries] = useAddBooksToSeriesMutation()
  const [removeFromSeries] = useRemoveBooksFromSeriesMutation()
  const [updateReadingStatus] = useUpdateReadingStatusMutation()

  return useMemo<RelationEditActions>(() => {
    switch (source) {
      case "tags":
        return {
          add: (books, item) => {
            void addTags({ tags: [{ uuid: item.uuid as UUID }], books })
          },
          remove: (books, uuid) => {
            void removeTags({ tags: [uuid], books })
          },
          singleSelect: false,
        }
      case "collections":
        return {
          add: (books, item) => {
            void addToCollections({
              collections: [item.uuid as UUID],
              books,
            })
          },
          remove: (books, uuid) => {
            void removeFromCollections({ collections: [uuid], books })
          },
          singleSelect: false,
        }
      case "series":
        return {
          add: (books, item) => {
            void addToSeries({
              series: { uuid: item.uuid as UUID, name: item.name },
              relations: books.map((bookUuid, index) => ({
                bookUuid,
                position: index + 1,
                featured: false,
              })),
            })
          },
          remove: (books, uuid) => {
            void removeFromSeries({ series: [uuid], books })
          },
          singleSelect: false,
        }
      case "statuses":
        return {
          add: (books, item) => {
            void updateReadingStatus({ status: item.uuid as UUID, books })
          },
          remove: () => {
            // status is single-valued; there is no "unset"
          },
          singleSelect: true,
        }
      // creators are filter-only; they are not edited through this picker
      case "creators":
        return {
          add: () => {},
          remove: () => {},
          singleSelect: false,
        }
    }
  }, [
    source,
    addTags,
    removeTags,
    addToCollections,
    removeFromCollections,
    addToSeries,
    removeFromSeries,
    updateReadingStatus,
  ])
}
