"use client"

import { IconLoader2 } from "@tabler/icons-react"

import { ShelfManager, ShelfRow } from "@v3/_/components/shelves"

import { useListHomeShelvesQuery } from "@/store/api"

export function HomeShelves() {
  const { data: homeShelves, isLoading } = useListHomeShelvesQuery()

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <IconLoader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  if (!homeShelves || homeShelves.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-muted-foreground text-sm">
          No shelves configured yet.
        </p>
        <ShelfManager />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      {homeShelves.map((shelf) => (
        <ShelfRow key={shelf.uuid} shelf={shelf} />
      ))}
    </div>
  )
}

export function HomeShelvesActions() {
  return <ShelfManager />
}
