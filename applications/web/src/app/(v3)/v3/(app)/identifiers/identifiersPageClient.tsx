"use client"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"
import { useTranslation } from "@v3/_/hooks/use-translation"

export function IdentifiersPageClient() {
  const t = useTranslation("LibraryPage")

  return (
    <LibraryPage
      title={t("Identifier.by")}
      section={librarySections.identifiers}
      noneLabel={t("Identifier.none")}
    />
  )
}
