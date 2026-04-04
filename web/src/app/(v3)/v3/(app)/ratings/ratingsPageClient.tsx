"use client"

import { useTranslations } from "next-intl"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"

export function RatingsPageClient() {
  const t = useTranslations("LibraryPage")

  return (
    <LibraryPage title={t("Rating.by")} section={librarySections.ratings} />
  )
}
