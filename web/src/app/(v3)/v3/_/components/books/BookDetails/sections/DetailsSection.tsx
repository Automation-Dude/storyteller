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

export function DetailsSection({ className }: { className?: string }) {
  const { book, form, isEditing } = useBookForm()
  const t = useTranslations("BookDetailsPage")
  const tLabels = useTranslations("Labels")
  const formatDate = useFormatDate()

  const languageValue = form.watch("language")
  const localeInfo = useMemo(
    () => getLocaleInfo(languageValue ?? ""),
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
                    localeInfo
                      ? "text-muted-foreground"
                      : "text-destructive",
                  )}
                >
                  {localeInfo ? (
                    <>
                      {localeInfo.displayName}
                      {localeInfo.maximized && (
                        <span className="text-muted-foreground/70">
                          {" "}
                          (interpreted as {localeInfo.maximized})
                        </span>
                      )}
                    </>
                  ) : (
                    t("invalidLanguageCode")
                  )}
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
