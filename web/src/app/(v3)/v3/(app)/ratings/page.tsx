"use client"

import { useTranslations } from "next-intl"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"

export default function RatingsPage() {
  const t = useTranslations("LibraryPage")

  return (
    <>
      <meta name="title" content={t("Rating.by")} />
      <LibraryPage title={t("Rating.by")} section={librarySections.ratings} />
    </>
  )
}
