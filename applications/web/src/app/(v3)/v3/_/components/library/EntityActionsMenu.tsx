"use client"

import { useState } from "react"

import { EntityEditDialog } from "@v3/_/components/library/EntityEditDialog"
import {
  type LibraryEntityType,
  type LibraryItem,
} from "@v3/_/components/library/library-sections"
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
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { useDeleteEntity } from "@v3/_/hooks/use-delete-entity"
import { usePinShelf } from "@v3/_/hooks/use-pin-shelf"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"

import { isWellKnownStatus } from "@/database/statusKinds"
import * as icon from "@/icons"
import { type ShelfFilterNode } from "@/shelves"
import { type UUID } from "@/uuid"

// the edit / pin-as-shelf / delete dropdown for a single library entity
// (tag, creator, series, collection, status). owns its edit dialog and delete
// confirmation, so any page header can offer the full set of entity actions.
export function EntityActionsMenu({
  entityType,
  item,
  toShelfFilter,
  onDeleted,
}: {
  entityType?: LibraryEntityType | undefined
  item: LibraryItem | null
  toShelfFilter?: ((itemKey: string) => ShelfFilterNode) | undefined
  onDeleted?: (() => void) | undefined
}) {
  const t = useTranslation("LibraryPage")
  const tEntity = useTranslation("EntityActions")
  const c = useCommon()

  const { pinShelf, isPinning } = usePinShelf()
  const canPin = !!toShelfFilter

  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const deleteEntity = useDeleteEntity(entityType)

  const deleteAction = useConfirmAction({
    onConfirm: async () => {
      if (!item) return
      await deleteEntity(item.key as UUID)
      onDeleted?.()
    },
    title: tEntity("deleteTitle", {
      count: 1,
      entity: entityType
        ? tEntity(`entityTypes.${entityType}` as "entityTypes.tag", {
            count: 1,
          })
        : "",
    }),
    description: tEntity("deleteDescription"),
    confirmLabel: c("actions.delete"),
    variant: "destructive",
  })

  if (!item || (!entityType && !canPin)) return null

  const isCoreStatus =
    entityType === "status" && !!item.kind && isWellKnownStatus(item.kind)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm">
              <icon.DotsVertical className="h-4 w-4" />
            </Button>
          }
        />

        <DropdownMenuContent align="end" className="min-w-40">
          {entityType && (
            <DropdownMenuItem
              onClick={() => {
                setEditDialogOpen(true)
              }}
            >
              <icon.Edit className="mr-2 h-4 w-4" />
              {c("actions.edit")}
            </DropdownMenuItem>
          )}

          {canPin && (
            <DropdownMenuItem
              disabled={isPinning}
              onClick={() => {
                void pinShelf(item.name, toShelfFilter(item.key))
              }}
            >
              <icon.BookmarkPlus className="mr-2 h-4 w-4" />
              {t("pinAsShelf")}
            </DropdownMenuItem>
          )}

          {entityType && !isCoreStatus && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(event) => {
                  deleteAction.confirm(event)
                }}
                className="text-destructive focus:text-destructive"
              >
                <icon.Trash className="mr-2 h-4 w-4" />
                {c("actions.delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {entityType && (
        <EntityEditDialog
          entityType={entityType}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          item={item}
        />
      )}

      <ConfirmDialog {...deleteAction.dialogProps} />
    </>
  )
}
