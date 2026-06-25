"use client"

import { useBookForm } from "@v3/_/components/books/BookDetails/BookFormProvider"
import { EditableText } from "@/app/(v3)/v3/_/components/books/BookDetails/EditableText"
import { LanguageEdit } from "@v3/_/components/books/LanguageEdit"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { bookDuration, bookPageCount } from "@v3/_/lib/bookMetrics"
import { useFormatDate } from "@v3/_/lib/date"
import { cn } from "@v3/_/lib/utils"

import { formatTimeHuman } from "@/components/reader/preferenceItems/formatTime"
import { CollapsibleSection } from "./CollapsibleSection"
import { IconBook } from "@tabler/icons-react"

type LocaleInfo = {
  displayName: string
  maximized: string | null
  isPartial: boolean
} | null

function getLocaleInfo(code: string): LocaleInfo {
  const trimmed = code.trim()

  if (!trimmed) {
    return null
  }

  try {
    const locale = new Intl.Locale(trimmed)
    const maximized = locale.maximize()
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" })
    const displayName = displayNames.of(maximized.toString())

    if (!displayName) {
      return null
    }

    const isPartial = maximized.toString() !== trimmed

    return {
      displayName,
      maximized: isPartial ? maximized.toString() : null,
      isPartial,
    }
  } catch {
    return null
  }
}

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
          {/* <EditableText
            name="language"
            className="text-sm"
            placeholder="e.g. en, nl, fr-FR"
            renderDisplay={(value) => {
              const info = getLocaleInfo(value)
              return (
                <span
                  className={cn(!info && "text-destructive")}
                  title={info?.maximized ?? undefined}
                >
                  {info?.displayName ?? value}
                </span>
              )
            }}
          /> */}
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

        <DetailRow label={tLabels("pages")}>
          <EditableText
            name="pageCount"
            type="number"
            className="text-sm"
            placeholder="Page count"
            renderDisplay={(value) => {
              const override = Number(value)
              const display =
                !isNaN(override) && override > 0 ? override : pages
              return display != null ? String(display) : null
            }}
          />
        </DetailRow>

        <DetailRow label={tLabels("duration")}>
          <EditableText
            name="duration"
            type="number"
            className="text-sm"
            placeholder="Duration (seconds)"
            renderDisplay={(value) => {
              const override = Number(value)
              const display =
                !isNaN(override) && override > 0 ? override : totalDuration
              return display != null ? formatTimeHuman(display) : null
            }}
          />
        </DetailRow>

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
