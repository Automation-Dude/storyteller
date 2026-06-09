"use client"

import {
  IconBookmarkPlus,
  IconDotsVertical,
  IconEdit,
  IconGitMerge,
  IconTrash,
  IconX,
} from "@tabler/icons-react"
import { type MouseEvent, useCallback, useMemo, useState } from "react"

import {
  type LibraryEntityType,
  type LibraryItem,
} from "@v3/_/components/library/library-sections"
import { ShelfEditor } from "@v3/_/components/shelves/ShelfEditor"
import { ActionBar } from "@v3/_/components/ui/action-bar"
import { Button } from "@v3/_/components/ui/button"
import {
  ConfirmDialog,
  useConfirmAction,
} from "@v3/_/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type ShelfFilterNode } from "@/shelves"
import {
  useDeleteCollectionMutation,
  useDeleteCreatorMutation,
  useDeleteSeriesMutation,
  useDeleteTagMutation,
  useMergeCollectionsMutation,
  useMergeCreatorsMutation,
  useMergeSeriesMutation,
  useMergeTagsMutation,
} from "@/store/api"
import { type UUID } from "@/uuid"

type SidebarEntityActionsProps = {
  entityType: LibraryEntityType
  selectedItems: Set<string>
  allItems: LibraryItem[]
  onStopSelecting: () => void
  onEdit?: (item: LibraryItem) => void
  toShelfFilter?: (itemKey: string) => ShelfFilterNode
}

function useEntityMutations(entityType: LibraryEntityType) {
  const [deleteTag] = useDeleteTagMutation()
  const [deleteCreator] = useDeleteCreatorMutation()
  const [deleteSeries] = useDeleteSeriesMutation()
  const [deleteCollection] = useDeleteCollectionMutation()

  const [mergeTags] = useMergeTagsMutation()
  const [mergeCreators] = useMergeCreatorsMutation()
  const [mergeSeriesM] = useMergeSeriesMutation()
  const [mergeCollections] = useMergeCollectionsMutation()

  const deleteEntity = useCallback(
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
      }
    },
    [entityType, deleteTag, deleteCreator, deleteSeries, deleteCollection],
  )

  const mergeEntities = useCallback(
    async (targetUuid: UUID, sourceUuids: UUID[]) => {
      switch (entityType) {
        case "tag":
          return mergeTags({ targetUuid, sourceUuids }).unwrap()
        case "creator":
          return mergeCreators({ targetUuid, sourceUuids }).unwrap()
        case "series":
          return mergeSeriesM({ targetUuid, sourceUuids }).unwrap()
        case "collection":
          return mergeCollections({ targetUuid, sourceUuids }).unwrap()
      }
    },
    [entityType, mergeTags, mergeCreators, mergeSeriesM, mergeCollections],
  )

  return { deleteEntity, mergeEntities }
}

export function SidebarEntityActions({
  entityType,
  selectedItems,
  allItems,
  onStopSelecting,
  onEdit,
  toShelfFilter,
}: SidebarEntityActionsProps) {
  const t = useTranslation("EntityActions")
  const { deleteEntity, mergeEntities } = useEntityMutations(entityType)
  const [isDeleting, setIsDeleting] = useState(false)
  const [shelfEditorOpen, setShelfEditorOpen] = useState(false)

  const selectedArray = Array.from(selectedItems)
  const selectedItemObjects = allItems.filter((item) =>
    selectedItems.has(item.key),
  )

  const count = selectedItems.size
  const singleSelected = count === 1 ? selectedItemObjects[0] : undefined

  // merge state
  const [mergeTarget, setMergeTarget] = useState<LibraryItem | null>(null)
  const [isMerging, setIsMerging] = useState(false)

  const combinedShelfFilter = useMemo<ShelfFilterNode | null>(() => {
    if (!toShelfFilter || selectedItemObjects.length === 0) return null

    const children = selectedItemObjects.map((item) => toShelfFilter(item.key))

    if (children.length === 1) return children[0] ?? null
    return { type: "or" as const, children }
  }, [toShelfFilter, selectedItemObjects])

  const suggestedShelfName = useMemo(
    () => selectedItemObjects.map((item) => item.name).join(", "),
    [selectedItemObjects],
  )

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)

    try {
      await Promise.all(selectedArray.map((uuid) => deleteEntity(uuid as UUID)))

      onStopSelecting()
    } finally {
      setIsDeleting(false)
    }
  }, [selectedArray, deleteEntity, onStopSelecting])

  const handleMerge = useCallback(async () => {
    if (!mergeTarget) return

    setIsMerging(true)

    try {
      const sourceUuids = selectedArray.filter(
        (uuid) => uuid !== mergeTarget.key,
      ) as UUID[]

      await mergeEntities(mergeTarget.key as UUID, sourceUuids)
      onStopSelecting()
    } finally {
      setIsMerging(false)
      setMergeTarget(null)
    }
  }, [mergeTarget, selectedArray, mergeEntities, onStopSelecting])

  const entityLabel = t(`entityTypes.${entityType}` as "entityTypes.tag", {
    count,
  })

  const deleteAction = useConfirmAction({
    onConfirm: handleDelete,
    title: t("deleteTitle", { count, entity: entityLabel }),
    description: t("deleteDescription"),
    confirmLabel: t("delete"),
    variant: "destructive",
  })

  const mergeAction = useConfirmAction({
    onConfirm: handleMerge,
    title: mergeTarget
      ? t("mergeTitle", { count, target: mergeTarget.name })
      : t("merge"),
    description: t("mergeDescription"),
    confirmLabel: t("merge"),
    variant: "default",
  })

  const handleMergeInto = useCallback(
    (target: LibraryItem, event: MouseEvent) => {
      setMergeTarget(target)
      mergeAction.confirm(event)
    },
    [mergeAction],
  )

  return (
    <>
      <ActionBar
        show={count > 0}
        className="absolute inset-x-2 bottom-2 gap-1 p-1.5"
      >
        <span className="text-muted-foreground flex-1 px-1 text-xs tabular-nums">
          {t("selected", { count })}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-xs">
                <IconDotsVertical className="size-3.5" />
              </Button>
            }
          />

          <DropdownMenuContent align="end" className="min-w-40">
            {onEdit && singleSelected && (
              <DropdownMenuItem
                onClick={() => {
                  onEdit(singleSelected)
                }}
              >
                <IconEdit className="mr-2 h-4 w-4" />
                {t("edit")}
              </DropdownMenuItem>
            )}

            {count >= 2 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <IconGitMerge className="mr-2 h-4 w-4" />
                  {t("mergeInto")}
                </DropdownMenuSubTrigger>

                <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                  {selectedItemObjects.map((item) => (
                    <DropdownMenuItem
                      key={item.key}
                      onClick={(event) => {
                        handleMergeInto(item, event)
                      }}
                    >
                      {item.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            {toShelfFilter && combinedShelfFilter && (
              <DropdownMenuItem
                onClick={() => {
                  setShelfEditorOpen(true)
                }}
              >
                <IconBookmarkPlus className="mr-2 h-4 w-4" />
                {t("createShelfWith")}
              </DropdownMenuItem>
            )}

            {(onEdit && singleSelected) || count >= 2 || toShelfFilter ? (
              <DropdownMenuSeparator />
            ) : null}

            <DropdownMenuItem
              onClick={(event) => {
                deleteAction.confirm(event)
              }}
              disabled={isDeleting}
              className="text-destructive focus:text-destructive"
            >
              <IconTrash className="mr-2 h-4 w-4" />
              {isDeleting ? t("deleting") : t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon-xs" onClick={onStopSelecting}>
          <IconX className="size-3.5" />
        </Button>
      </ActionBar>

      <ConfirmDialog {...deleteAction.dialogProps} />
      <ConfirmDialog {...mergeAction.dialogProps} isLoading={isMerging} />

      {toShelfFilter && (
        <ShelfEditor
          open={shelfEditorOpen}
          onOpenChange={setShelfEditorOpen}
          initialFilter={combinedShelfFilter}
          initialName={suggestedShelfName}
        />
      )}
    </>
  )
}
