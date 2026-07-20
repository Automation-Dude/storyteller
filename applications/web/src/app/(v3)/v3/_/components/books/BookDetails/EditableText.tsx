"use client"

import { type ElementType, useEffect, useRef, useState } from "react"
import { Controller, type FieldPath, useWatch } from "react-hook-form"

import { Field, FieldError } from "@v3/_/components/ui/field"
import { cn } from "@v3/_/lib/utils"

import { useBookForm } from "./BookFormProvider"
import { InlineFieldChrome } from "./InlineEditChrome"
import { type BookFormValues } from "./schema"

// display and editor share this box so swapping between them never shifts
// layout: identical padding + a 1px border (transparent when displaying).
export const SEAMLESS_BOX =
  "-mx-1.5 w-full rounded-md border px-1.5 py-0.5 transition-colors"

type EditableTextProps = {
  name: FieldPath<BookFormValues>
  /** typography classes applied to BOTH the display node and the editor */
  className?: string
  /** display element when not editing (h1, p, span, ...) */
  as?: ElementType
  placeholder?: string
  type?: "text" | "date" | "number"
  multiline?: boolean
  /** custom display rendering (e.g. formatted/derived value) */
  renderDisplay?: (value: string) => React.ReactNode
  /** extra classes for the wrapping field */
  fieldClassName?: string
}

/**
 * Single scalar book field that can be edited in place.
 * Input is text-ish, like a string, date, number
 */
export function EditableText({
  name,
  className,
  as: As = "span",
  placeholder,
  type = "text",
  multiline = false,
  renderDisplay,
  fieldClassName,
}: EditableTextProps) {
  const {
    form,
    canEdit,
    isEditing,
    editingField,
    setEditingField,
    commitField,
  } = useBookForm()

  const value = useWatch({ control: form.control, name }) as string | null
  const active = canEdit && (isEditing || editingField === name)

  const inlineMode = editingField === name && !isEditing

  const originalRef = useRef<HTMLDivElement | null>(null)
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  )

  // focus when entering single-field inline mode
  useEffect(() => {
    if (inlineMode && ref.current) {
      ref.current.focus()
      if (ref.current instanceof HTMLInputElement && type === "text") {
        ref.current.select()
      }
    }
  }, [inlineMode, type])

  if (!active) {
    const text = typeof value === "string" ? value.trim() : ""
    return (
      <As
        className={cn(
          SEAMLESS_BOX,
          "block border-transparent",
          canEdit && "hover:border-input hover:bg-input/10 cursor-text",
          className,
          !text && "text-muted-foreground italic",
        )}
        role={canEdit ? "button" : undefined}
        ref={originalRef}
        tabIndex={canEdit ? 0 : undefined}
        onClick={
          canEdit
            ? () => {
                setEditingField(name)
                setSize(
                  originalRef.current?.getBoundingClientRect() ?? {
                    width: 0,
                    height: 0,
                  },
                )
              }
            : undefined
        }
        onKeyDown={
          canEdit
            ? (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setEditingField(name)
                  setSize(
                    originalRef.current?.getBoundingClientRect() ?? {
                      width: 0,
                      height: 0,
                    },
                  )
                }
              }
            : undefined
        }
      >
        {text ? (renderDisplay ? renderDisplay(text) : text) : placeholder}
      </As>
    )
  }

  return (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => {
        const commonProps = {
          id: name,
          value: (field.value as string | null) ?? "",
          name: field.name,
          placeholder,
          "aria-invalid": fieldState.invalid || undefined,
          onChange: field.onChange,
          onBlur: () => {
            field.onBlur()
            if (inlineMode) {
              if (
                form.getFieldState(name).isDirty &&
                JSON.stringify(field.value) !== JSON.stringify(value)
              ) {
                void commitField(name)
              } else {
                setEditingField(null)
              }
            }
          },
          onKeyDown: (
            e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
          ) => {
            if (e.key === "Escape") {
              e.preventDefault()
              e.stopPropagation()
              form.resetField(name)
              setEditingField(null)
            }
            if (e.key === "Enter" && !multiline) {
              e.preventDefault()
              if (inlineMode) void commitField(name)
            }
          },
        }

        const inputClassName = inlineMode
          ? cn(
              "border-input focus-visible:border-ring aria-invalid:border-destructive w-full border-0 border-b border-dashed bg-transparent px-0 py-0.5 outline-none",
              "placeholder:text-muted-foreground placeholder:not-italic",
              className,
            )
          : cn(
              SEAMLESS_BOX,
              "border-input bg-input/20 dark:bg-input/30 outline-none",
              "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[2px]",
              "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-[2px]",
              "placeholder:text-muted-foreground placeholder:not-italic",
              className,
            )

        // when floating, the field fills the card; the measured size is reserved
        // by the spacer below instead.
        const inputStyle = inlineMode
          ? { width: "100%" }
          : { width: size?.width ?? "100%", height: size?.height }

        const editor = (
          <Field orientation="vertical" className={cn("gap-1", fieldClassName)}>
            {type === "text" ? (
              <textarea
                {...commonProps}
                ref={(el) => {
                  field.ref(el)
                  ref.current = el
                }}
                // single line for scalar fields, taller for multiline ones.
                // when we measured the display box (inline edit) the size below
                // takes over; in global edit there is nothing to measure, so we
                // fall back to content sizing instead of a fixed 5-row height.
                rows={multiline ? 5 : 1}
                style={inputStyle}
                className={cn(inputClassName, "field-sizing-content resize-y")}
              />
            ) : (
              <input
                {...commonProps}
                type={type}
                style={inputStyle}
                className={inputClassName}
                ref={(el) => {
                  field.ref(el)
                  ref.current = el
                }}
              />
            )}
            <FieldError errors={[fieldState.error]} />
          </Field>
        )

        // in global edit mode the bottom edit bar owns save/discard; only the
        // single-field inline edit wears its own chrome.
        if (!inlineMode) return editor

        return (
          <InlineFieldChrome name={name} size={size}>
            {editor}
          </InlineFieldChrome>
        )
      }}
    />
  )
}
