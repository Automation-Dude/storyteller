import { IconFolder, IconPlus } from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"

import {
  useAddBooksToCollectionsMutation,
  useListCollectionsQuery,
  useRemoveBooksFromCollectionsMutation,
} from "@/store/api"
import { type UUID } from "@/uuid"

import { CreateCollectionDialog } from "./CreateCollectionDialog"
import { RelationChipEditor } from "./RelationChipEditor"

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

  const t = useTranslations("BookDetailsPage.collections")
  const tLabels = useTranslations("Labels")

  const handleAdd = useCallback(
    async (collectionUuid: string) => {
      await addToCollections({
        collections: [collectionUuid as UUID],
        books: [bookUuid as UUID],
      })
      onUpdate()
    },
    [addToCollections, bookUuid, onUpdate],
  )

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

  const handleCreated = useCallback(
    async (uuid: string) => {
      await addToCollections({
        collections: [uuid as UUID],
        books: [bookUuid as UUID],
      })
      onUpdate()
    },
    [addToCollections, bookUuid, onUpdate],
  )

  return (
    <>
      <CreateCollectionDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handleCreated}
        initialName={createDialogInitialName}
      />

      <RelationChipEditor
        items={collections}
        allItems={allCollections}
        icon={IconFolder}
        badgeVariant="secondary"
        groupName="collections"
        editMode={editMode}
        searchPlaceholder={t("seachOrCreateCollection")}
        emptyText={t("notInAnyCollections")}
        onSelectItem={(c) => handleAdd(c.uuid)}
        onRemoveItem={handleRemove}
        renderCreateAction={(search, closePopover) => (
          <button
            type="button"
            aria-label={tLabels("create.withInput", {
              input: `"${search.trim()}"`,
            })}
            onClick={() => {
              closePopover()
              setCreateDialogInitialName(search.trim())
              setShowCreateDialog(true)
            }}
            className="hover:bg-accent text-primary flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
          >
            <IconPlus className="h-3 w-3" />
            {tLabels("create.withInput", { input: `"${search.trim()}"` })}
          </button>
        )}
      />
    </>
  )
}
