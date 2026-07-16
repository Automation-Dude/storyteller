import { useMemo, useState } from "react"
import { useWatch } from "react-hook-form"

import { Button } from "@v3/_/components/ui/button"
import {
  FilterableMenu,
  FilterableMenuContent,
  FilterableMenuTrigger,
} from "@v3/_/components/ui/filterable-menu"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"

import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import * as icon from "@/icons"
import { useListAuthorsQuery, useListNarratorsQuery } from "@/store/api"

import { useBookForm } from "./BookDetails/BookFormProvider"
import { RelationChipEditor } from "./RelationChipEditor"
import { RelationSelectList } from "./relation-picker/RelationSelectList"

function CreatorAddMenu({
  allItems,
  values,
  onToggle,
  onCreate,
  searchPlaceholder,
}: {
  allItems: { uuid: string; name: string }[]
  values: string[]
  onToggle: (name: string) => void
  onCreate: (name: string) => void
  searchPlaceholder: string
}) {
  const [open, setOpen] = useState(false)
  const c = useCommon()
  const tLabels = useTranslation("Labels")

  const applied = useMemo(() => new Set(values), [values])
  const items = useMemo(
    () => allItems.map((a) => ({ uuid: a.uuid, name: a.name })),
    [allItems],
  )

  return (
    <FilterableMenu open={open} onOpenChange={setOpen}>
      <FilterableMenuTrigger
        render={
          <TooltipButton
            tooltip={c.plain("actions.add")}
            aria-label={c.plain("actions.add")}
            variant="ghost"
          >
            <icon.Plus size="sm" className="text-muted-foreground" />
          </TooltipButton>
        }
      />
      <FilterableMenuContent searchPlaceholder={searchPlaceholder}>
        <RelationSelectList
          items={items}
          enabled={open}
          stateOf={(item) => (applied.has(item.name) ? "primary" : "none")}
          onSelect={(item) => {
            onToggle(item.name)
          }}
          create={{
            label: (s) =>
              tLabels.plain("create.withInput", { input: `"${s}"` }),
            onCreate,
          }}
        />
      </FilterableMenuContent>
    </FilterableMenu>
  )
}

function CreatorChipField({
  field,
  label,
  searchPlaceholder,
  items,
  allItems,
}: {
  field: "authors" | "narrators"
  label: string
  searchPlaceholder: string
  items: { uuid: string; name: string }[]
  allItems: { uuid: string; name: string }[]
}) {
  const { form, isEditing, editingField, setEditingField, commitField } =
    useBookForm()
  const c = useCommon()
  const values = useWatch({
    control: form.control,
    name: field,
  })

  const inline = editingField === field && !isEditing

  const setValues = (next: string[]) => {
    form.setValue(field, next, { shouldDirty: true })
  }

  const toggle = (name: string) => {
    if (values.includes(name)) {
      setValues(values.filter((n) => n !== name))
    } else {
      setValues([...values, name])
    }
  }

  return (
    <div className="mt-3">
      <span className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase">
        {label}
      </span>

      <RelationChipEditor
        items={items}
        badgeVariant="outline"
        source="creators"
        editMode
        emptyText=""
        canInteract
        onRemoveItem={(item) => {
          setValues(values.filter((name) => name !== item.name))
        }}
      >
        <CreatorAddMenu
          allItems={allItems}
          values={values}
          onToggle={toggle}
          onCreate={(name) => {
            setValues([...values, name])
          }}
          searchPlaceholder={searchPlaceholder}
        />
      </RelationChipEditor>

      {inline && (
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              void commitField(field)
            }}
          >
            <icon.Check className="mr-1 h-3.5 w-3.5" />
            {c("actions.save")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              form.resetField(field)
              setEditingField(null)
            }}
          >
            <icon.Close className="mr-1 h-3.5 w-3.5" />
            {c("actions.cancel")}
          </Button>
        </div>
      )}
    </div>
  )
}

export function AuthorEditor() {
  const { form } = useBookForm()
  const t = useTranslation()
  const c = useCommon()

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
      label={c.plain("fields.label.authors")}
      searchPlaceholder={t.plain("BookDetailsPage.addAuthor")}
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
      label={t.plain("Labels.narrators")}
      searchPlaceholder={t.plain("BookDetailsPage.addNarrator")}
      items={narratorItems}
      allItems={allNarrators}
    />
  )
}
