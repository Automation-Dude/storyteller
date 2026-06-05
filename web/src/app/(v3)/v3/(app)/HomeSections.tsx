"use client"

import { IconLoader2 } from "@tabler/icons-react"
import { useTranslations } from "next-intl"

import { HeroSection } from "@v3/_/components/home/HeroSection"
import { StatsBar } from "@v3/_/components/home/StatsBar"
import { ShelfManager, ShelfRow } from "@v3/_/components/shelves"

import { type HomeSectionWithDetails } from "@/database/shelves"
import { useListHomeShelvesQuery } from "@/store/api"

function Section({
  section,
  index,
}: {
  section: HomeSectionWithDetails
  index: number
}) {
  // shelves manage their own px-4 gutter (with scroll bleed); widgets don't, so
  // pad them to line up with the shelf headers.
  switch (section.kind) {
    case "hero":
      return (
        <div className="px-4">
          <HeroSection />
        </div>
      )
    case "stats":
      return (
        <div className="px-4">
          <StatsBar />
        </div>
      )
    default:
      return <ShelfRow shelf={section} />
  }
}

export function HomeSections() {
  const t = useTranslations("HomePage")
  const { data: sections, isLoading } = useListHomeShelvesQuery()

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <IconLoader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  if (!sections || sections.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-muted-foreground text-sm">
          {t("sections.empty")}
        </p>
        <ShelfManager />
      </div>
    )
  }

  return (
    <div className="-mt-[calc(var(--header-height)+1rem)] flex flex-col gap-8 py-4">
      {sections
        .filter((section) => section.enabled)
        .map((section, index) => (
          <Section key={section.uuid} section={section} index={index} />
        ))}
    </div>
  )
}

export function HomeSectionsActions() {
  return <ShelfManager />
}
