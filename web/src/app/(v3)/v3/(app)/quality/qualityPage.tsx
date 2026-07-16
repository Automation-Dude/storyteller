"use client"

import { useCallback } from "react"

import { useBookListPageState } from "@v3/_/components/books/BookListPage"
import { LibraryPage } from "@v3/_/components/library/LibraryPage"
import {
  ALL_KEY,
  librarySections,
} from "@v3/_/components/library/library-sections"
import { Button } from "@v3/_/components/ui/button"

import * as icon from "@/icons"
import { type ShelfFilterCondition } from "@/shelves"
import { useGetAlignmentFacetsQuery } from "@/store/api"

export default function QualityPage() {
  return (
    <LibraryPage
      title="Alignment quality"
      section={librarySections.grades}
      itemLabels={{ [ALL_KEY]: "All graded" }}
      bookClickMode="report"
      afterFilters={<MutedToggle />}
      emptyMessage="No graded books yet"
      contentClassName="p-6 [&_.font-heading]:text-[0.8125rem]!"
    />
  )
}

// the muted-chapters toggle writes an ordinary condition onto the page's
// filter controller so it stays in sync with the filter bar's chips.
function MutedToggle() {
  const { controller } = useBookListPageState()
  const { conditionsForField, setConditionsForField, removeField } = controller

  const { data: facets } = useGetAlignmentFacetsQuery()

  const mutedActive = conditionsForField("alignmentMutedChapters").some(
    (c) => c.operator === "greaterThan",
  )

  const toggleMuted = useCallback(() => {
    if (mutedActive) {
      removeField("alignmentMutedChapters")
      return
    }
    const cond: ShelfFilterCondition = {
      type: "condition",
      field: "alignmentMutedChapters",
      operator: "greaterThan",
      value: 0,
    }
    setConditionsForField("alignmentMutedChapters", [cond])
  }, [mutedActive, removeField, setConditionsForField])

  return (
    <div className="flex items-center px-4 pt-2">
      <Button
        variant={mutedActive ? "secondary" : "ghost"}
        size="sm"
        onClick={toggleMuted}
        className="gap-1.5"
      >
        <icon.VolumeOff className="size-4" />
        Muted
        {facets && facets.muted > 0 && (
          <span className="text-muted-foreground tabular-nums">
            {facets.muted}
          </span>
        )}
      </Button>
    </div>
  )
}
