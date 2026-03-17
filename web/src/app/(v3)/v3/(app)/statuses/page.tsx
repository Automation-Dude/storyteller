"use client"

import { useTranslations } from "next-intl"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"

export default function StatusesPage() {
  const t = useTranslations("LibraryPage")

  return (
    <>
      <meta name="title" content={t("Status.by")} />
      <LibraryPage title={t("Status.by")} section={librarySections.statuses} />
    </>
  )
}
