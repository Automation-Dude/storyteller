import { useCallback, useMemo, useState } from "react"

import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"


import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import { usePermission } from "@/hooks/usePermission"
import * as icon from "@/icons"
import {
  useAddBooksToCollectionsMutation,
  useListCollectionsQuery,
  useRemoveBooksFromCollectionsMutation,
} from "@/store/api"
import { type UUID } from "@/uuid"

import { CreateCollectionDialog } from "./CreateCollectionDialog"
import { RelationChipEditor } from "./RelationChipEditor"
import { RelationEditMenu } from "./relation-picker/RelationEditMenu"

type CollectionEditorProps = {
  bookUuid: string
  collections: Array<{ uuid: string; name: string }>
  onUpdate: () => void
  editMode?: boolean
}

export function CollectionEditor({
  bookUuid,
  collections,
  onUpdate,
  editMode = false,
}: CollectionEditorProps) {
  const { data: allCollections = [] } = useListCollectionsQuery()
  const [addToCollections] = useAddBooksToCollectionsMutation()
  const [removeFromCollections] = useRemoveBooksFromCollectionsMutation()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createDialogInitialName, setCreateDialogInitialName] = useState("")

  const t = useTranslation("BookDetailsPage.collections")
  const tActions = useTranslation("BookActions")
  const tLabels = useTranslation("Labels")
  const c = useCommon()
  const canUpdate = usePermission("bookUpdate")
  const canInteract = editMode || canUpdate

  const handleRemove = useCallback(
    async (item: { uuid: string }) => {
      await removeFromCollections({
        collections: [item.uuid as UUID],
        books: [bookUuid as UUID],
      })
      onUpdate()
    },
    [removeFromCollections, bookUuid, onUpdate],
  )

  const collectionItems = collections.map((collection) => {
    const full = allCollections.find((c) => c.uuid === collection.uuid)
    return {
      uuid: collection.uuid,
      name: collection.name,
      url: `/collections?item=${collection.uuid}`,
      icon: full?.icon ?? null,
      color: full?.color ?? null,
    }
  })

  const membership = useMemo(
    () => new Map(collections.map((collection) => [collection.uuid, 1])),
    [collections],
  )

  return (
    <>
      <CreateCollectionDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        initialName={createDialogInitialName}
        onCreated={(uuid) => {
          void addToCollections({
            collections: [uuid as UUID],
            books: [bookUuid as UUID],
          })
          onUpdate()
        }}
      />

      <RelationChipEditor
        items={collectionItems}
        badgeVariant="secondary"
        source="collections"
        editMode={editMode}
        emptyText={t("notInAnyCollections")}
        onRemoveItem={handleRemove}
        canInteract={!!canInteract}
      >
        {canUpdate && (
          <RelationEditMenu
            source="collections"
            bookUuids={[bookUuid as UUID]}
            membership={membership}
            searchPlaceholder={tActions.plain("search")}
            onCreate={(name) => {
              setCreateDialogInitialName(name)
              setShowCreateDialog(true)
            }}
            createLabel={(s) =>
              tLabels.plain("create.withInput", { input: `"${s}"` })
            }
            trigger={
              <TooltipButton
                tooltip={c.plain("actions.add")}
                aria-label={c.plain("actions.add")}
                variant="ghost"
              >
                <icon.Add className="size-4" />
              </TooltipButton>
            }
          />
        )}
      </RelationChipEditor>
    </>
  )
}
