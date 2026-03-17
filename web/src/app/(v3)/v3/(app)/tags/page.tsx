"use client"

import { useTranslations } from "next-intl"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"

export default function TagsPage() {
  const t = useTranslations("LibraryPage")

  return (
    <>
      <meta name="title" content={t("Tags.by")} />
      <LibraryPage title={t("Tags.by")} section={librarySections.tags} />
    </>
  )
}
