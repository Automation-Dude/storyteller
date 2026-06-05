import { IconMicrophone, IconUser } from "@tabler/icons-react"
import { useMemo } from "react"
import { useWatch } from "react-hook-form"

import { useTranslation } from "@v3/_/hooks/use-translation"

import { useListAuthorsQuery, useListNarratorsQuery } from "@/store/api"

import { useBookForm } from "./BookDetails/BookFormProvider"
import { RelationChipEditor } from "./RelationChipEditor"

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
    <div className="mt-3">
      <span className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase">
        {t("Labels.authors")}
      </span>

      <RelationChipEditor
        items={authorItems}
        allItems={allAuthors}
        icon={IconUser}
        badgeVariant="outline"
        groupName="authors"
        editMode
        searchPlaceholder={t("BookDetailsPage.addAuthor")}
        emptyText=""
        onSelectItem={(item) => {
          form.setValue("authors", [...formAuthors, item.name])
        }}
        onRemoveItem={(item) => {
          form.setValue(
            "authors",
            formAuthors.filter((name) => name !== item.name),
          )
        }}
        canCreateInline
        onCreateInline={(name) => {
          form.setValue("authors", [...formAuthors, name])
        }}
      />
    </div>
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
    <div className="mt-3">
      <span className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase">
        {t("Labels.narrators")}
      </span>

      <RelationChipEditor
        items={narratorItems}
        allItems={allNarrators}
        icon={IconMicrophone}
        badgeVariant="outline"
        groupName="narrators"
        editMode
        searchPlaceholder={t("BookDetailsPage.addNarrator")}
        emptyText=""
        onSelectItem={(item) => {
          form.setValue("narrators", [...formNarrators, item.name])
        }}
        onRemoveItem={(item) => {
          form.setValue(
            "narrators",
            formNarrators.filter((name) => name !== item.name),
          )
        }}
        canCreateInline
        onCreateInline={(name) => {
          form.setValue("narrators", [...formNarrators, name])
        }}
      />
    </div>
  )
}
