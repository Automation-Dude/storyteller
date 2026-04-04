import { IconLibrary } from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { useCallback } from "react"

import {
  useAddBooksToSeriesMutation,
  useListSeriesQuery,
  useRemoveBooksFromSeriesMutation,
} from "@/store/api"
import { type UUID } from "@/uuid"

import { RelationChipEditor } from "./RelationChipEditor"

type SeriesWithPosition = {
  uuid: string
  name: string
  position: number | null
  featured: boolean
}

type SeriesEditorProps = {
  bookUuid: string
  series: SeriesWithPosition[]
  onUpdate: () => void
  editMode?: boolean
}

export function SeriesEditor({
  bookUuid,
  series,
  onUpdate,
  editMode = false,
}: SeriesEditorProps) {
  const { data: allSeries = [] } = useListSeriesQuery()
  const [addToSeries] = useAddBooksToSeriesMutation()
  const [removeFromSeries] = useRemoveBooksFromSeriesMutation()

  const t = useTranslations("BookDetailsPage.series")

  const handleAdd = useCallback(
    async (seriesName: string, seriesUuid?: string) => {
      await addToSeries({
        series: seriesUuid
          ? { uuid: seriesUuid as UUID, name: seriesName }
          : { name: seriesName },
        relations: [
          {
            bookUuid: bookUuid as UUID,
            position: null,
            featured: series.length === 0,
          },
        ],
      })
      onUpdate()
    },
    [addToSeries, bookUuid, series.length, onUpdate],
  )

  const handleRemove = useCallback(
    async (item: { uuid: string }) => {
      await removeFromSeries({
        series: [item.uuid as UUID],
        books: [bookUuid as UUID],
      })
      onUpdate()
    },
    [removeFromSeries, bookUuid, onUpdate],
  )

  return (
    <RelationChipEditor
      items={series}
      allItems={allSeries}
      icon={IconLibrary}
      badgeVariant="outline"
      groupName="series"
      editMode={editMode}
      searchPlaceholder={t("seachOrCreateSeries")}
      emptyText={t("notInAnySeries")}
      onSelectItem={(s) => handleAdd(s.name, s.uuid)}
      onRemoveItem={handleRemove}
      canCreateInline
      onCreateInline={(name) => handleAdd(name)}
      renderBadgeExtra={(s) =>
        s.position !== null ? (
          <span className="text-muted-foreground">#{s.position}</span>
        ) : null
      }
    />
  )
}
