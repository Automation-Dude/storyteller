"use client"

import { useTranslations } from "next-intl"

import { useGetHomeStatsQuery } from "@/store/api"

export function StatsBar() {
  const t = useTranslations("HomePage")
  const { data: stats } = useGetHomeStatsQuery()

  if (!stats) return null

  const tiles = [
    { key: "inProgress", value: stats.inProgress, label: t("stats.inProgress") },
    {
      key: "finishedThisYear",
      value: stats.finishedThisYear,
      label: t("stats.finishedThisYear"),
    },
    { key: "inLibrary", value: stats.inLibrary, label: t("stats.inLibrary") },
    {
      key: "tags",
      value: stats.tags,
      label: t("stats.tags"),
      detail: t("stats.authors", { count: stats.authors }),
    },
  ]

  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl @2xl/main:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.key} className="bg-muted/40 px-5 py-5">
          <p className="font-heading text-primary text-3xl leading-none font-medium @xl/main:text-4xl">
            {tile.value}
          </p>
          <p className="text-muted-foreground mt-2 text-xs font-medium tracking-[0.12em] uppercase">
            {tile.label}
          </p>
          {tile.detail && (
            <p className="text-muted-foreground/70 mt-1 text-xs">
              {tile.detail}
            </p>
          )}
        </div>
      ))}
    </section>
  )
}
