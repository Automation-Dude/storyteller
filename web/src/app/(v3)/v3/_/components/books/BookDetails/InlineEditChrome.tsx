"use client"

import { type FieldPath } from "react-hook-form"

import { Kbd } from "@v3/_/components/ui/kbd"
import { useCommon } from "@v3/_/hooks/use-translation"

import { cn } from "@/cn"
import * as icon from "@/icons"

import { useBookForm } from "./BookFormProvider"
import { type BookFormValues } from "./schema"

// the card drawn around a single field being edited inline: a rounded, bordered,
// shadowed panel with a terracotta rule running flush down the left edge, and a
// save / discard row with keyboard hints beneath the field. it replaces the old
// floating pill so the confirm affordance sits on the field it acts on.
//
// `floating` overlays the card (absolutely) so the extra row never reflows the
// surrounding layout -- it just covers whatever sits below it. the caller then
// reserves the field's original footprint with a relatively-positioned spacer.
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
        "border-border bg-background z-50 flex overflow-hidden rounded-xl border shadow-lg",
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
            {/* mousedown + preventDefault so the field doesn't blur-commit
                before the click handler runs */}
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

// wraps a single field's editor in the floating chrome, reserving the field's
// original footprint (via `size`) so the card overlays the layout instead of
// reflowing it. save/discard is identical for every field, so it lives here:
// commit the field on save, revert + leave inline mode on discard.
export function InlineFieldChrome({
  name,
  size,
  inline,
  children,
}: {
  name: FieldPath<BookFormValues>
  size: { width: number; height: number } | null
  // reserve footprint as an inline-block (for fields sitting in flowing text)
  // rather than a block
  inline?: boolean
  children: React.ReactNode
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
