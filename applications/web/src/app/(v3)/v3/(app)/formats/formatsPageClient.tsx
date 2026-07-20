"use client"

import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import { librarySections } from "@v3/_/components/library/library-sections"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"

import { FORMAT_VALUES } from "@/fields"

export function FormatsPageClient() {
  const t = useTranslation("LibraryPage")
  const c = useCommon()

  const itemLabels = Object.fromEntries(
    FORMAT_VALUES.map((value) => [
      value,
      c.plain(
        `fields.options.format.${value}` as "fields.options.format.ebook",
      ),
    ]),
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
