import { useCallback, useMemo, useState } from "react"

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
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"

import {
  useAddBooksToSeriesMutation,
  useRemoveBooksFromSeriesMutation,
} from "@/store/api"
import { usePermission } from "@/hooks/usePermission"
import { type UUID } from "@/uuid"

import { RelationChipEditor } from "./RelationChipEditor"
import { RelationEditMenu } from "./relation-picker/RelationEditMenu"
import { IAdd } from "../ui/icon"
import { TooltipButton } from "../ui/tooltip-button"

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
type EditingPosition = {
  uuid: string
  name: string
  currentPosition: number | null
}

export function SeriesEditor({
  bookUuid,
  series,
  onUpdate,
  editMode = false,
}: SeriesEditorProps) {
  const [addToSeries] = useAddBooksToSeriesMutation()
  const [removeFromSeries] = useRemoveBooksFromSeriesMutation()

  const t = useTranslation("BookDetailsPage.series")
  const tActions = useTranslation("BookActions")
  const tLabels = useTranslation("Labels")
  const c = useCommon()
  const canUpdate = usePermission("bookUpdate")
  const canInteract = editMode || canUpdate

  const [pending, setPending] = useState<PendingSeries | null>(null)
  const [position, setPosition] = useState("")
  const [editing, setEditing] = useState<EditingPosition | null>(null)

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

  const handleEditPosition = useCallback(
    (s: { uuid: string; name: string; position: number | null }) => {
      setEditing({ uuid: s.uuid, name: s.name, currentPosition: s.position })
      setPosition(s.position != null ? String(s.position) : "")
    },
    [],
  )

  const handleUpdatePosition = useCallback(async () => {
    if (!editing) return

    const trimmed = position.trim()
    const existing = series.find((s) => s.uuid === editing.uuid)

    await addToSeries({
      series: { uuid: editing.uuid as UUID, name: editing.name },
      relations: [
        {
          bookUuid: bookUuid as UUID,
          position: trimmed === "" ? null : Number(trimmed),
          featured: existing?.featured ?? false,
        },
      ],
    })

    setEditing(null)
    onUpdate()
  }, [editing, position, addToSeries, bookUuid, series, onUpdate])

  const seriesItems = series.map((s) => ({
    uuid: s.uuid,
    name: s.name,
    url: `/series?item=${s.uuid}`,
    position: s.position,
    featured: s.featured,
  }))

  const membership = useMemo(
    () => new Map(series.map((s) => [s.uuid, 1])),
    [series],
  )

  return (
    <>
      <RelationChipEditor
        items={seriesItems}
        badgeVariant="outline"
        source="series"
        editMode={editMode}
        emptyText={t("notInAnySeries")}
        onRemoveItem={handleRemove}
        canInteract={!!canInteract}
        renderBadgeExtra={(s) => {
          if (!editMode && s.position != null) {
            return <span className="text-muted-foreground">#{s.position}</span>
          }

          if (editMode) {
            return (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground cursor-pointer underline"
                onClick={(e) => {
                  e.stopPropagation()
                  handleEditPosition(s)
                }}
              >
                {s.position != null ? `#${s.position}` : "#?"}
              </button>
            )
          }

          return null
        }}
      >
        {canUpdate && (
          // series keeps its position dialog: the picker only picks (existing or
          // new); handlePick opens the position prompt. removal is via the chips.
          <RelationEditMenu
            source="series"
            bookUuids={[bookUuid as UUID]}
            membership={membership}
            showApplied={false}
            searchPlaceholder={tActions.plain("search")}
            onSelectOverride={(item) => {
              handlePick(item.name, item.uuid)
            }}
            onCreate={(name) => {
              handlePick(name)
            }}
            createLabel={(s) =>
              tLabels.plain("create.withInput", { input: `"${s}"` })
            }
            trigger={
              <TooltipButton
                tooltip={c.plain("actions.add")}
                aria-label={c.plain("actions.add")}
                variant="ghost"
              >
                <IAdd.base size="sm" className="text-muted-foreground" />
              </TooltipButton>
            }
          />
        )}
      </RelationChipEditor>

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
                {c("actions.cancel")}
              </Button>
              <Button type="submit">{c("actions.add")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editPositionTitle")}</DialogTitle>
            <DialogDescription>
              {t("editPositionDescription", { series: editing?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleUpdatePosition()
            }}
          >
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="edit-series-position">
                  {t("position")}
                </FieldLabel>
                <Input
                  id="edit-series-position"
                  type="number"
                  step="any"
                  autoFocus
                  placeholder={t("positionPlaceholder")}
                  value={position}
                  onChange={(e) => {
                    setPosition(e.target.value)
                  }}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null)
                }}
              >
                {c("actions.cancel")}
              </Button>
              <Button type="submit">{c("actions.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
