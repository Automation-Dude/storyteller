"use client"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"
import { useTranslation } from "@v3/_/hooks/use-translation"

export function StatusesPageClient() {
  const t = useTranslation("LibraryPage")

  return (
    <LibraryPage
      title={t("Status.by")}
      section={librarySections.statuses}
      noneLabel={t("Status.none")}
    />
  )
}
