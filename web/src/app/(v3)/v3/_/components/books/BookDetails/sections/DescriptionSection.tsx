"use client"

import { useEffect, useRef, useState } from "react"
import { Controller, useWatch } from "react-hook-form"

import { useBookForm } from "@v3/_/components/books/BookDetails/BookFormProvider"
import { Field, FieldError } from "@v3/_/components/ui/field"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { cn } from "@/cn"

const COLLAPSED_HEIGHT = 96

// the read-only description. while collapsed it has to be expanded ("show more")
// before a click hands off to editing, so a tap meant to read the rest of the
// blurb doesn't drop the user straight into a textarea.
function CollapsibleDescription({
  html,
  canEdit,
  onEdit,
}: {
  html: string
  canEdit: boolean
  onEdit: () => void
}) {
  const t = useTranslation("BookDetailsPage")
  const contentRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    setIsOverflowing(el.scrollHeight > COLLAPSED_HEIGHT + 8)
  }, [html])

  const mustExpandFirst = !expanded && isOverflowing
  const editableNow = canEdit && !mustExpandFirst

  return (
    <div className="relative">
      <div
        ref={contentRef}
        role={mustExpandFirst || editableNow ? "button" : undefined}
        tabIndex={mustExpandFirst || editableNow ? 0 : undefined}
        onClick={() => {
          if (mustExpandFirst) {
            setExpanded(true)
            return
          }
          if (canEdit) onEdit()
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return
          e.preventDefault()
          if (mustExpandFirst) {
            setExpanded(true)
            return
          }
          if (canEdit) onEdit()
        }}
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none overflow-hidden text-xs transition-[max-height] duration-300",
          mustExpandFirst && "cursor-pointer",
          editableNow &&
            "hover:bg-input/10 -mx-1.5 cursor-text rounded-md px-1.5",
        )}
        style={{
          maxHeight: expanded
            ? contentRef.current?.scrollHeight
            : COLLAPSED_HEIGHT,
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {mustExpandFirst && (
        <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t to-transparent" />
      )}

      {isOverflowing && (
        <button
          type="button"
          onClick={() => {
            setExpanded((prev) => !prev)
          }}
          className="text-primary mt-1 text-xs font-medium hover:underline"
        >
          {expanded ? t("showLess") : t("showMore")}
        </button>
      )}
    </div>
  )
}

export function DescriptionSection({ className }: { className?: string }) {
  const t = useTranslation("BookDetailsPage")
  const tLabels = useTranslation("Labels")
  const {
    form,
    canEdit,
    isEditing,
    editingField,
    setEditingField,
    commitField,
  } = useBookForm()

  const value = useWatch({ control: form.control, name: "description" })
  const active = canEdit && (isEditing || editingField === "description")
  const inlineMode = editingField === "description" && !isEditing

  return (
    <section className={className}>
      <h2 className="section-label mb-3">{tLabels("description")}</h2>

      {active ? (
        <Controller
          name="description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field orientation="vertical" className="gap-1">
              <textarea
                {...field}
                value={field.value ?? ""}
                autoFocus={inlineMode}
                rows={6}
                placeholder={t("noDescriptionAvailable")}
                aria-invalid={fieldState.invalid || undefined}
                onBlur={() => {
                  field.onBlur()
                  if (!inlineMode) return
                  if (form.getFieldState("description").isDirty) {
                    void commitField("description")
                  } else {
                    setEditingField(null)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault()
                    form.resetField("description")
                    setEditingField(null)
                  }
                }}
                className={cn(
                  "field-sizing-content w-full resize-y rounded-md border px-1.5 py-0.5 text-xs",
                  "border-input bg-input/20 dark:bg-input/30 outline-none",
                  "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[2px]",
                  "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-[2px]",
                )}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      ) : value && value.trim() ? (
        <CollapsibleDescription
          html={value}
          canEdit={canEdit}
          onEdit={() => {
            setEditingField("description")
          }}
        />
      ) : (
        <p
          role={canEdit ? "button" : undefined}
          tabIndex={canEdit ? 0 : undefined}
          onClick={
            canEdit
              ? () => {
                  setEditingField("description")
                }
              : undefined
          }
          className={cn(
            "text-muted-foreground text-xs italic",
            canEdit &&
              "hover:bg-input/10 -mx-1.5 cursor-text rounded-md px-1.5",
          )}
        >
          {t("noDescriptionAvailable")}
        </p>
      )}
    </section>
  )
}
