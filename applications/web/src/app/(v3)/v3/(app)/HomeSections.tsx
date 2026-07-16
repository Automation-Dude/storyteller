"use client"

import { HeroSection } from "@v3/_/components/home/HeroSection"
import { StatsBar } from "@v3/_/components/home/StatsBar"
import { ShelfManager, ShelfRow } from "@v3/_/components/shelves"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import { type HomeSectionWithDetails } from "@/database/shelves"
import * as icon from "@/icons"
import { useListHomeShelvesQuery } from "@/store/api"

function Section({ section }: { section: HomeSectionWithDetails }) {
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
  const t = useTranslation("HomePage")
  const { data: sections, isLoading } = useListHomeShelvesQuery()

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <icon.Loader className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  if (!sections || sections.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-muted-foreground text-sm">{t("sections.empty")}</p>
        <ShelfManager />
      </div>
    )
  }

  return (
    <div className="-mt-[calc(var(--header-height)+1rem)] flex flex-col gap-8 py-4">
      {sections
        .filter((section) => section.enabled)
        .map((section) => (
          <Section key={section.uuid} section={section} />
        ))}
    </div>
  )
}

export function HomeSectionsActions() {
  const t = useTranslation("HomePage")
  return (
    <ShelfManager
      trigger={
        <TooltipButton
          variant="ghost"
          size="sm"
          tooltip={t("sections.customize")}
          aria-label={t("sections.customize")}
        >
          <icon.Books className="mr-2 size-4" />
        </TooltipButton>
      }
    />
  )
}
