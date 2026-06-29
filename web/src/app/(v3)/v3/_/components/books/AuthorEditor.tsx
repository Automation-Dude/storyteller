import { IconCheck, IconMicrophone, IconUser, IconX } from "@tabler/icons-react"
import { type ComponentType, useMemo } from "react"
import { useWatch } from "react-hook-form"

import { Button } from "@v3/_/components/ui/button"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { useListAuthorsQuery, useListNarratorsQuery } from "@/store/api"

import { useBookForm } from "./BookDetails/BookFormProvider"
import { type BookFormValues } from "./BookDetails/schema"
import { RelationChipEditor } from "./RelationChipEditor"

function CreatorChipField({
  field,
  label,
  icon,
  searchPlaceholder,
  items,
  allItems,
}: {
  field: "authors" | "narrators"
  label: string
  icon: ComponentType<{ className?: string }>
  searchPlaceholder: string
  items: { uuid: string; name: string }[]
  allItems: { uuid: string; name: string }[]
}) {
  const { form, isEditing, editingField, setEditingField, commitField } =
    useBookForm()
  const t = useTranslation("BookDetailsPage")
  const values = useWatch({
    control: form.control,
    name: field,
  })

  const inline = editingField === field && !isEditing

  const setValues = (next: string[]) => {
    form.setValue(field, next, { shouldDirty: true })
  }

  return (
    <div className="mt-3">
      <span className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase">
        {label}
      </span>

      <RelationChipEditor
        items={items}
        allItems={allItems}
        icon={icon}
        badgeVariant="outline"
        groupName={field}
        editMode
        searchPlaceholder={searchPlaceholder}
        emptyText=""
        onSelectItem={(item) => {
          setValues([...values, item.name])
        }}
        onRemoveItem={(item) => {
          setValues(values.filter((name) => name !== item.name))
        }}
        canCreateInline
        onCreateInline={(name) => {
          setValues([...values, name])
        }}
      />

      {inline && (
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              void commitField(field)
            }}
          >
            <IconCheck className="mr-1 h-3.5 w-3.5" />
            {t("review.save")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              form.resetField(field)
              setEditingField(null)
            }}
          >
            <IconX className="mr-1 h-3.5 w-3.5" />
            {t("review.cancel")}
          </Button>
        </div>
      )}
    </div>
  )
}

export function AuthorEditor() {
  const { form } = useBookForm()
  const t = useTranslation()

  const formAuthors = useWatch({ control: form.control, name: "authors" })
  const { data: allAuthors = [] } = useListAuthorsQuery()

  const authorItems = useMemo(() => {
    const uuidByName = new Map(
      allAuthors.map((a) => [a.name.toLowerCase(), a.uuid]),
    )

    return formAuthors.map((name) => ({
      uuid: uuidByName.get(name.toLowerCase()) ?? `__new_${name}`,
      name,
    }))
  }, [formAuthors, allAuthors])

  return (
    <CreatorChipField
      field="authors"
      label={t("Labels.authors")}
      icon={IconUser}
      searchPlaceholder={t("BookDetailsPage.addAuthor")}
      items={authorItems}
      allItems={allAuthors}
    />
  )
}

export function NarratorEditor() {
  const { form } = useBookForm()
  const t = useTranslation()

  const formNarrators = useWatch({ control: form.control, name: "narrators" })
  const { data: allNarrators = [] } = useListNarratorsQuery()

  const narratorItems = useMemo(() => {
    const uuidByName = new Map(
      allNarrators.map((a) => [a.name.toLowerCase(), a.uuid]),
    )

    return formNarrators.map((name) => ({
      uuid: uuidByName.get(name.toLowerCase()) ?? `__new_${name}`,
      name,
    }))
  }, [formNarrators, allNarrators])

  return (
    <CreatorChipField
      field="narrators"
      label={t("Labels.narrators")}
      icon={IconMicrophone}
      searchPlaceholder={t("BookDetailsPage.addNarrator")}
      items={narratorItems}
      allItems={allNarrators}
    />
  )
}
