import { IconLibrary } from "@tabler/icons-react"
import { useCallback, useState } from "react"

import { Button } from "@v3/_/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v3/_/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@v3/_/components/ui/field"
import { Input } from "@v3/_/components/ui/input"
import { useTranslation } from "@v3/_/hooks/use-translation"

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

// the series the user picked but hasn't committed yet, while they set a position
type PendingSeries = { name: string; uuid?: string }

export function SeriesEditor({
  bookUuid,
  series,
  onUpdate,
  editMode = false,
}: SeriesEditorProps) {
  const { data: allSeries = [] } = useListSeriesQuery()
  const [addToSeries] = useAddBooksToSeriesMutation()
  const [removeFromSeries] = useRemoveBooksFromSeriesMutation()

  const t = useTranslation("BookDetailsPage.series")

  const [pending, setPending] = useState<PendingSeries | null>(null)
  const [position, setPosition] = useState("")

  // selecting/creating a series opens the position prompt rather than adding
  // immediately, so the user can place the book within the series.
  const handlePick = useCallback((name: string, uuid?: string) => {
    setPending(uuid ? { name, uuid } : { name })
    setPosition("")
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!pending) return

    const trimmed = position.trim()
    await addToSeries({
      series: pending.uuid
        ? { uuid: pending.uuid as UUID, name: pending.name }
        : { name: pending.name },
      relations: [
        {
          bookUuid: bookUuid as UUID,
          position: trimmed === "" ? null : Number(trimmed),
          featured: series.length === 0,
        },
      ],
    })
    setPending(null)
    onUpdate()
  }, [pending, position, addToSeries, bookUuid, series.length, onUpdate])

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

  const seriesItems = series.map((s) => ({
    uuid: s.uuid,
    name: s.name,
    url: `/series?item=${s.uuid}`,
    position: s.position,
    featured: s.featured,
  }))

  return (
    <>
      <RelationChipEditor
        items={seriesItems}
        allItems={allSeries}
        icon={IconLibrary}
        badgeVariant="outline"
        groupName="series"
        editMode={editMode}
        searchPlaceholder={t("seachOrCreateSeries")}
        emptyText={t("notInAnySeries")}
        onSelectItem={(s) => {
          handlePick(s.name, s.uuid)
        }}
        onRemoveItem={handleRemove}
        canCreateInline
        onCreateInline={(name) => {
          handlePick(name)
        }}
        renderBadgeExtra={(s) =>
          s.position !== null ? (
            <span className="text-muted-foreground">#{s.position}</span>
          ) : null
        }
      />

      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addToSeriesTitle")}</DialogTitle>
            <DialogDescription>
              {t("addToSeriesDescription", { series: pending?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
          >
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="series-position">
                  {t("position")}
                </FieldLabel>
                <Input
                  id="series-position"
                  type="number"
                  step="any"
                  autoFocus
                  placeholder={t("positionPlaceholder")}
                  value={position}
                  onChange={(e) => {
                    setPosition(e.target.value)
                  }}
                />
                <FieldDescription>{t("positionHint")}</FieldDescription>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPending(null)
                }}
              >
                {t("cancel")}
              </Button>
              <Button type="submit">{t("add")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
