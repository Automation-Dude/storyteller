"use client"

import { useTranslations } from "next-intl"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"

export function NarratorsPageClient() {
  const t = useTranslations("LibraryPage")

  return (
    <LibraryPage
      title={t("Narrators.by")}
      section={librarySections.narrators}
    />
  )
}
