"use client"

import { useTranslations } from "next-intl"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"

export default function NarratorsPage() {
  const t = useTranslations("LibraryPage")

  return (
    <>
      <meta name="title" content={t("Narrators.by")} />
      <LibraryPage
        title={t("Narrators.by")}
        section={librarySections.narrators}
      />
    </>
  )
}
