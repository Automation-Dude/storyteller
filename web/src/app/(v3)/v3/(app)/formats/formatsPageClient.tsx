"use client"

import { useMemo } from "react"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"
import { useTranslation } from "@v3/_/hooks/use-translation"

export function FormatsPageClient() {
  const t = useTranslation("LibraryPage")

  const itemLabels = useMemo(
    () => ({
      readaloud: t("Formats.readaloud"),
      "audiobook-ebook": t("Formats.audiobook-ebook"),
      "audiobook-only": t("Formats.audiobook-only"),
      "ebook-only": t("Formats.ebook-only"),
      "no-media": t("Formats.no-media"),
    }),
    [t],
  )

  return (
    <LibraryPage
      title={t("Formats.by")}
      section={librarySections.formats}
      itemLabels={itemLabels}
      defaultSidebarSort="count"
    />
  )
}
