import { useCallback, useMemo } from "react"

import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"

import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import { usePermission } from "@/hooks/usePermission"
import * as icon from "@/icons"
import {
  useAddTagsToBooksMutation,
  useRemoveTagsFromBooksMutation,
} from "@/store/api"
import { type UUID } from "@/uuid"

import { RelationChipEditor } from "./RelationChipEditor"
import { RelationEditMenu } from "./relation-picker/RelationEditMenu"

type TagEditorProps = {
  bookUuid: string
  tags: Array<{ uuid: string; name: string }>
  onUpdate: () => void
  editMode?: boolean
  className?: string
}

export function TagEditor({
  bookUuid,
  tags,
  onUpdate,
  editMode = false,
  className,
}: TagEditorProps) {
  const [addTags] = useAddTagsToBooksMutation()
  const [removeTags] = useRemoveTagsFromBooksMutation()

  const t = useTranslation("BookDetailsPage.tags")
  const tActions = useTranslation("BookActions")
  const tLabels = useTranslation("Labels")
  const c = useCommon()
  const canUpdate = usePermission("bookUpdate")
  const canInteract = editMode || canUpdate

  const handleRemove = useCallback(
    async (tag: { uuid: string }) => {
      await removeTags({ tags: [tag.uuid as UUID], books: [bookUuid as UUID] })
      onUpdate()
    },
    [removeTags, bookUuid, onUpdate],
  )

  const handleCreate = useCallback(
    (name: string) => {
      void addTags({ tags: [{ name }], books: [bookUuid as UUID] })
      onUpdate()
    },
    [addTags, bookUuid, onUpdate],
  )

  const membership = useMemo(
    () => new Map(tags.map((tag) => [tag.uuid, 1])),
    [tags],
  )

  return (
    <RelationChipEditor
      items={tags}
      badgeVariant="outline"
      source="tags"
      editMode={editMode}
      emptyText={t("notInAnyTags")}
      onRemoveItem={handleRemove}
      canInteract={!!canInteract}
      className={className}
    >
      {canUpdate && (
        <RelationEditMenu
          source="tags"
          bookUuids={[bookUuid as UUID]}
          membership={membership}
          searchPlaceholder={tActions.plain("search")}
          onCreate={handleCreate}
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
  )
}
