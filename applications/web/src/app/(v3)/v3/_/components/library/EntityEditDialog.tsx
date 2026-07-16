"use client"

import { EditCreatorDialog } from "@v3/_/components/library/EditCreatorDialog"
import { EditStatusDialog } from "@v3/_/components/library/EditStatusDialog"
import { EditTagDialog } from "@v3/_/components/library/EditTagDialog"
import {
  type FacetValue,
  type LibraryEntityType,
} from "@v3/_/components/library/library-sections"

import { CreateCollectionDialog } from "@/app/(v3)/v3/_/components/books/CreateCollectionDialog"
import { EditSeriesDialog } from "@/app/(v3)/v3/_/components/books/EditSeriesDialog"
import { type UUID } from "@/uuid"

export function EntityEditDialog({
  entityType,
  open,
  onOpenChange,
  item,
}: {
  entityType: LibraryEntityType
  open: boolean
  onOpenChange: (open: boolean) => void
  item: FacetValue | null
}) {
  if (entityType === "tag") {
    return (
      <EditTagDialog
        open={open}
        onOpenChange={onOpenChange}
        tag={item ? { uuid: item.key, name: item.name } : null}
      />
    )
  }

  if (entityType === "creator") {
    return (
      <EditCreatorDialog
        open={open}
        onOpenChange={onOpenChange}
        creator={
          item ? { uuid: item.key, name: item.name, fileAs: null } : null
        }
      />
    )
  }

  if (entityType === "series") {
    return (
      <EditSeriesDialog
        open={open}
        onOpenChange={onOpenChange}
        series={
          item
            ? { uuid: item.key as UUID, name: item.name, description: null }
            : null
        }
      />
    )
  }

  if (entityType === "status") {
    return (
      <EditStatusDialog
        open={open}
        onOpenChange={onOpenChange}
        status={item ? { uuid: item.key, name: item.name } : null}
      />
    )
  }

  // the only remaining entity type is "collection"
  return (
    <CreateCollectionDialog
      open={open}
      onOpenChange={onOpenChange}
      collectionUuid={item ? item.key : null}
    />
  )
}
