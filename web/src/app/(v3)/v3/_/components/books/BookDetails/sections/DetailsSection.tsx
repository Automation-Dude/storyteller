"use client"

import { IconBook } from "@tabler/icons-react"

import { useBookForm } from "@v3/_/components/books/BookDetails/BookFormProvider"
import { LanguageEdit } from "@v3/_/components/books/LanguageEdit"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { bookDuration, bookPageCount } from "@v3/_/lib/bookMetrics"
import { useFormatDate } from "@v3/_/lib/date"

import { EditableText } from "@/app/(v3)/v3/_/components/books/BookDetails/EditableText"
import { formatTimeHuman } from "@/components/reader/preferenceItems/formatTime"

import { CollapsibleSection } from "./CollapsibleSection"

// a single label + value pair occupying two grid cells, so the grid keeps the
// same shape whether the value is read-only or an inline editor.
function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  if (children == null || children === "") return null

  return (
    <>
      <span className="text-muted-foreground self-center text-xs uppercase">
        {label}
      </span>
      <div className="text-sm">{children}</div>
    </>
  )
}

export function DetailsSection({ className }: { className?: string }) {
  const { book } = useBookForm()
  const tLabels = useTranslation("Labels")
  const formatDate = useFormatDate()

  const pages = bookPageCount(book)
  const totalDuration = bookDuration(book)

  return (
    <CollapsibleSection
      title={tLabels("bookDetails")}
      icon={<IconBook className="size-3.5 stroke-[1.5]" />}
      className={className}
    >
      <div className="grid grid-cols-2 items-start gap-x-4 gap-y-2">
        <DetailRow label={tLabels("language")}>
          <LanguageEdit />
        </DetailRow>

        <DetailRow label={tLabels("publicationDate")}>
          <EditableText
            name="publicationDate"
            type="date"
            className="min-h-8 text-sm"
            renderDisplay={(value) =>
              formatDate(value, { timeStyle: undefined })
            }
          />
        </DetailRow>

        {pages != null && (
          <DetailRow label={tLabels("pages")}>
            <span className="text-sm tabular-nums">{pages}</span>
          </DetailRow>
        )}

        {totalDuration != null && (
          <DetailRow label={tLabels("duration")}>
            <span className="text-sm tabular-nums">
              {formatTimeHuman(totalDuration)}
            </span>
          </DetailRow>
        )}

        <DetailRow label={tLabels("added")}>
          {formatDate(book.createdAt)}
        </DetailRow>

        <DetailRow label={tLabels("lastUpdated")}>
          {formatDate(book.updatedAt)}
        </DetailRow>
      </div>
    </CollapsibleSection>
  )
}
