"use client"

import { useBookForm } from "@v3/_/components/books/BookDetails/BookFormProvider"
import { EditableText } from "@v3/_/components/books/BookDetails/EditableField"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { bookDuration, bookPageCount } from "@v3/_/lib/bookMetrics"
import { useFormatDate } from "@v3/_/lib/date"
import { cn } from "@v3/_/lib/utils"

import { formatTimeHuman } from "@/components/reader/preferenceItems/formatTime"

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
    <section className={className}>
      <h2 className="section-label mb-4">{tLabels("bookDetails")}</h2>

      <div className="grid grid-cols-2 items-start gap-x-4 gap-y-2">
        <DetailRow label={tLabels("language")}>
          <EditableText
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
          />
        </DetailRow>

        <DetailRow label={tLabels("publicationDate")}>
          <EditableText
            name="publicationDate"
            type="date"
            className="text-sm"
            renderDisplay={(value) =>
              formatDate(value, { timeStyle: undefined })
            }
          />
        </DetailRow>

        {pages != null && (
          <DetailRow label={tLabels("pages")}>{pages}</DetailRow>
        )}

        {totalDuration != null && (
          <DetailRow label={tLabels("duration")}>
            {formatTimeHuman(totalDuration)}
          </DetailRow>
        )}

        <DetailRow label={tLabels("added")}>
          {formatDate(book.createdAt)}
        </DetailRow>

        <DetailRow label={tLabels("lastUpdated")}>
          {formatDate(book.updatedAt)}
        </DetailRow>
      </div>
    </section>
  )
}
