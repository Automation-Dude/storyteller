"use client"

import { type FieldPath } from "react-hook-form"

import { Kbd } from "@v3/_/components/ui/kbd"
import { useCommon } from "@v3/_/hooks/use-translation"

import { cn } from "@/cn"
import * as icon from "@/icons"

import { useBookForm } from "./BookFormProvider"
import { type BookFormValues } from "./schema"

export function InlineEditChrome({
  children,
  onSave,
  onDiscard,
  isSaving,
  floating,
  className,
}: {
  children: React.ReactNode
  onSave: () => void
  onDiscard: () => void
  isSaving?: boolean
  floating?: boolean
  className?: string
}) {
  const c = useCommon()

  return (
    <div
      className={cn(
        "tint-surface border-border bg-background z-50 flex overflow-hidden rounded-xl border shadow-lg",
        floating ? "absolute top-0 left-0 min-w-full" : "w-full",
        className,
      )}
    >
      <div className="bg-primary w-[3px] shrink-0" aria-hidden />

      <div className="min-w-0 flex-1 py-2 pr-2 pl-2.5">
        {children}

        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Kbd>↵</Kbd>
            <span>{c("actions.save").toLowerCase()}</span>
            <span className="text-muted-foreground/40">·</span>
            <Kbd>esc</Kbd>
            <span>{c("actions.discard").toLowerCase()}</span>
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={c("actions.discard")}
              onMouseDown={(e) => {
                e.preventDefault()
                onDiscard()
              }}
              disabled={isSaving}
              className="text-muted-foreground hover:text-foreground hover:bg-muted flex size-6 items-center justify-center rounded-full transition-colors disabled:opacity-50"
            >
              <icon.Close className="size-4" />
            </button>

            <button
              type="button"
              aria-label={c("actions.save")}
              onMouseDown={(e) => {
                e.preventDefault()
                onSave()
              }}
              disabled={isSaving}
              className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <icon.Check className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function InlineFieldChrome({
  name,
  size,
  inline,
  children,
}: {
  name: FieldPath<BookFormValues>
  size: { width: number; height: number } | null
  children: React.ReactNode
  inline?: boolean
}) {
  const { form, isSaving, setEditingField, commitField } = useBookForm()

  return (
    <div
      className={cn("relative", inline && "inline-block align-top")}
      style={{ width: size?.width, height: size?.height }}
    >
      <InlineEditChrome
        floating
        isSaving={isSaving}
        onSave={() => void commitField(name)}
        onDiscard={() => {
          form.resetField(name)
          setEditingField(null)
        }}
      >
        {children}
      </InlineEditChrome>
    </div>
  )
}
