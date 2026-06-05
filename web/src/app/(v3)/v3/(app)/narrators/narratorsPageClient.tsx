"use client"


import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"
import { useTranslation } from "@v3/_/hooks/use-translation"

export function NarratorsPageClient() {
  const t = useTranslation("LibraryPage")

  return (
    <LibraryPage
      title={t("Narrators.by")}
      section={librarySections.narrators}
    />
  )
}
