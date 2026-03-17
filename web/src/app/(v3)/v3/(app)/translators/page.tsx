"use client"

import { useTranslations } from "next-intl"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"

export default function TranslatorsPage() {
  const t = useTranslations("LibraryPage")

  return (
    <>
      <meta name="title" content={t("Translators.by")} />
      <LibraryPage
        title={t("Translators.by")}
        section={librarySections.translators}
      />
    </>
  )
}
