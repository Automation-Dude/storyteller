"use client"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"
import { useTranslation } from "@v3/_/hooks/use-translation"

export function PublicationYearsPageClient() {
  const t = useTranslation("LibraryPage")

  return (
    <LibraryPage
      title={t("PublicationYear.by")}
      section={librarySections.publicationYears}
      noneLabel={t("PublicationYear.none")}
    />
  )
}
