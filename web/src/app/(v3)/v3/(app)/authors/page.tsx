"use client"

import { useTranslations } from "next-intl"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"

export default function AuthorsPage() {
  const t = useTranslations("LibraryPage")

  return (
    <>
      <meta name="title" content={t("Authors.by")} />
      <LibraryPage title={t("Authors.by")} section={librarySections.authors} />
    </>
  )
}
