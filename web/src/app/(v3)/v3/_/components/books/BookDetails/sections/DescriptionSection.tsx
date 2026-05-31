"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { useBookForm } from "@v3/_/components/books/BookDetails/BookFormProvider"
import { Label } from "@v3/_/components/ui/label"
import { Textarea } from "@v3/_/components/ui/textarea"

import { cn } from "@/cn"

const COLLAPSED_HEIGHT = 96

function CollapsibleDescription({ html }: { html: string }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    setIsOverflowing(el.scrollHeight > COLLAPSED_HEIGHT + 8)
  }, [html])

  return (
    <div>
      <div className="relative">
        <div
          ref={contentRef}
          className={cn(
            "prose prose-sm dark:prose-invert max-w-none overflow-hidden text-xs transition-[max-height] duration-300",
          )}
          style={{ maxHeight: expanded ? contentRef.current?.scrollHeight : COLLAPSED_HEIGHT }}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {!expanded && isOverflowing && (
          <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t to-transparent" />
        )}
      </div>

      {isOverflowing && (
        <button
          type="button"
          onClick={() => {
            setExpanded((prev) => !prev)
          }}
          className="text-primary mt-1 text-xs font-medium hover:underline"
        >
          {expanded ? "Hide" : "Show more"}
        </button>
      )}
    </div>
  )
}

export function DescriptionSection({ className }: { className?: string }) {
  const { book, form, isEditing } = useBookForm()
  const t = useTranslations("BookDetailsPage")
  const tLabels = useTranslations("Labels")

  return (
    <section className={className}>
      {isEditing ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description" className="section-label mb-3">
            {tLabels("description")}
          </Label>

          <Textarea
            id="description"
            {...form.register("description")}
            className="min-h-32 resize-y"
          />
        </div>
      ) : book.description ? (
        <div>
          <h2 className="section-label mb-3">{tLabels("description")}</h2>

          <CollapsibleDescription html={book.description} />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm italic">
          {t("noDescriptionAvailable")}
        </p>
      )}
    </section>
  )
}
