import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"

import { type RelationSource } from "@/app/(v3)/v3/_/hooks/use-relation-items"

import { RelationFormField } from "./RelationFormField"

// authors and narrators are name-list fields (string[]); identity is the name
function CreatorFormField({
  field,
  source,
  label,
  searchPlaceholder,
  className,
}: {
  field: "authors" | "narrators"
  source: RelationSource
  label: string
  searchPlaceholder: string
  className?: string
}) {
  return (
    <RelationFormField
      name={field}
      source={source}
      entryId={(name) => name}
      itemId={(item) => item.name}
      toChip={(name) => ({ uuid: name, name })}
      entryFromPick={(item) => item.name}
      createEntry={(name) => name}
      label={label}
      badgeVariant="outline"
      searchPlaceholder={searchPlaceholder}
      className={className}
    />
  )
}

export function AuthorEditor({ className }: { className?: string }) {
  const t = useTranslation()
  const c = useCommon()

  return (
    <CreatorFormField
      field="authors"
      source="authors"
      label={c.plain("fields.label.authors")}
      searchPlaceholder={t.plain("BookDetailsPage.addAuthor")}
      className={className}
    />
  )
}

export function NarratorEditor({ className }: { className?: string }) {
  const t = useTranslation()

  return (
    <CreatorFormField
      field="narrators"
      source="narrators"
      label={t.plain("Labels.narrators")}
      searchPlaceholder={t.plain("BookDetailsPage.addNarrator")}
      className={className}
    />
  )
}
