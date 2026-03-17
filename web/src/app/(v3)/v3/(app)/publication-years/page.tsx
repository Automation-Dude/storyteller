"use client"

import { useTranslations } from "next-intl"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"

export default function PublicationYearsPage() {
  const t = useTranslations("LibraryPage")

  return (
    <>
      <meta name="title" content={t("PublicationYear.by")} />
      <LibraryPage
        title={t("PublicationYear.by")}
        section={librarySections.publicationYears}
      />
    </>
  )
}
