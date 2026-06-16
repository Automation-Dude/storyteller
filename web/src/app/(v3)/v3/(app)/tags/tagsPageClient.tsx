"use client"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"
import { useTranslation } from "@v3/_/hooks/use-translation"

export function TagsPageClient() {
  const t = useTranslation("LibraryPage")

  return (
    <LibraryPage
      title={t("Tags.by")}
      section={librarySections.tags}
      noneLabel={t("Tags.none")}
    />
  )
}
