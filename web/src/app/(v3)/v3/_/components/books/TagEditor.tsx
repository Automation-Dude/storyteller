import { IconTag } from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { useCallback } from "react"

import {
  useAddTagsToBooksMutation,
  useListTagsQuery,
  useRemoveTagsFromBooksMutation,
} from "@/store/api"
import { type UUID } from "@/uuid"

import { RelationChipEditor } from "./RelationChipEditor"

type TagEditorProps = {
  bookUuid: string
  tags: Array<{ uuid: string; name: string }>
  onUpdate: () => void
  editMode?: boolean
}

export function TagEditor({
  bookUuid,
  tags,
  onUpdate,
  editMode = false,
}: TagEditorProps) {
  const { data: allTags = [] } = useListTagsQuery()
  const [addTags] = useAddTagsToBooksMutation()
  const [removeTags] = useRemoveTagsFromBooksMutation()

  const t = useTranslations("BookDetailsPage.tags")

  const handleAdd = useCallback(
    async (tagName: string) => {
      await addTags({
        tags: [tagName],
        books: [bookUuid as UUID],
      })
      onUpdate()
    },
    [addTags, bookUuid, onUpdate],
  )

  const handleRemove = useCallback(
    async (tag: { uuid: string }) => {
      await removeTags({
        tags: [tag.uuid as UUID],
        books: [bookUuid as UUID],
      })
      onUpdate()
    },
    [removeTags, bookUuid, onUpdate],
  )

  return (
    <RelationChipEditor
      items={tags}
      allItems={allTags}
      icon={IconTag}
      badgeVariant="outline"
      groupName="tags"
      editMode={editMode}
      searchPlaceholder={t("seachOrCreateTag")}
      emptyText={t("notInAnyTags")}
      onSelectItem={(tag) => handleAdd(tag.name)}
      onRemoveItem={handleRemove}
      canCreateInline
      onCreateInline={handleAdd}
    />
  )
}
