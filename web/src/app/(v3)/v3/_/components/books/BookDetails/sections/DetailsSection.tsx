"use client"

import { IconCalendar, IconLanguage } from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { useMemo } from "react"

import { Input } from "@v3/_/components/ui/input"
import { Label } from "@v3/_/components/ui/label"
import { useFormatDate } from "@v3/_/lib/date"
import { cn } from "@v3/_/lib/utils"

import { useBookForm } from "../BookFormProvider"
import { MetadataRow } from "../MetadataRow"

export function getLanguageDisplayName(code: string): string | null {
  const trimmed = code.trim()

  if (!trimmed) {
    return null
  }

  try {
    new Intl.Locale(trimmed)
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" })
    const name = displayNames.of(trimmed)

    if (!name || name === trimmed) {
      return null
    }

    return name
  } catch {
    return null
  }
}

export function DetailsSection({ className }: { className?: string }) {
  const { book, form, isEditing } = useBookForm()
  const t = useTranslations("BookDetailsPage")
  const tLabels = useTranslations("Labels")
  const formatDate = useFormatDate()

  const languageValue = form.watch("language")
  const languageDisplayName = useMemo(
    () => getLanguageDisplayName(languageValue ?? ""),
    [languageValue],
  )

  return (
    <section className={className}>
      <h2 className="mb-4 text-sm font-medium">{tLabels("bookDetails")}</h2>

      <div className="flex flex-wrap gap-4">
        {isEditing ? (
          <>
            <div>
              <Label htmlFor="language">{tLabels("language")}</Label>

              <Input
                id="language"
                {...form.register("language")}
                className="mt-1"
                placeholder="e.g. en, nl, fr-FR"
              />

              {languageValue && (
                <p
                  className={cn(
                    "mt-1 text-xs",
                    languageDisplayName
                      ? "text-muted-foreground"
                      : "text-destructive",
                  )}
                >
                  {languageDisplayName ?? t("invalidLanguageCode")}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="publicationDate">
                {tLabels("publicationDate")}
              </Label>

              <Input
                id="publicationDate"
                type="date"
                {...form.register("publicationDate")}
                className="mt-1"
              />
            </div>
          </>
        ) : (
          <>
            <MetadataRow icon={IconLanguage} label={tLabels("language")}>
              {book.language}
            </MetadataRow>

            <MetadataRow icon={IconCalendar} label={tLabels("publicationDate")}>
              {book.publicationDate && formatDate(book.publicationDate)}
            </MetadataRow>

            <MetadataRow icon={IconCalendar} label={tLabels("added")}>
              {formatDate(book.createdAt)}
            </MetadataRow>

            <MetadataRow icon={IconCalendar} label={tLabels("lastUpdated")}>
              {formatDate(book.updatedAt)}
            </MetadataRow>
          </>
        )}
      </div>
    </section>
  )
}
