"use client"

import { useTranslations } from "next-intl"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"

export function StatusesPageClient() {
  const t = useTranslations("LibraryPage")

  return (
    <LibraryPage title={t("Status.by")} section={librarySections.statuses} />
  )
}
