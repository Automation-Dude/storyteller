"use client"

import { useCallback } from "react"

import { type LibraryEntityType } from "@v3/_/components/library/library-sections"

import {
  useDeleteCollectionMutation,
  useDeleteCreatorMutation,
  useDeleteSeriesMutation,
  useDeleteStatusMutation,
  useDeleteTagMutation,
} from "@/store/api"
import { type UUID } from "@/uuid"

export function useDeleteEntity(entityType?: LibraryEntityType) {
  const [deleteTag] = useDeleteTagMutation()
  const [deleteCreator] = useDeleteCreatorMutation()
  const [deleteSeries] = useDeleteSeriesMutation()
  const [deleteCollection] = useDeleteCollectionMutation()
  const [deleteStatusMut] = useDeleteStatusMutation()

  return useCallback(
    async (uuid: UUID) => {
      switch (entityType) {
        case "tag":
          return deleteTag({ uuid }).unwrap()
        case "creator":
          return deleteCreator({ uuid }).unwrap()
        case "series":
          return deleteSeries({ uuid }).unwrap()
        case "collection":
          return deleteCollection({ uuid }).unwrap()
        case "status":
          return deleteStatusMut({ uuid }).unwrap()
      }
    },
    [
      entityType,
      deleteTag,
      deleteCreator,
      deleteSeries,
      deleteCollection,
      deleteStatusMut,
    ],
  )
}
