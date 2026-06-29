"use client"

import {
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconEyeOff,
  IconGripVertical,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconSettings,
  IconTrash,
} from "@tabler/icons-react"
import { Reorder, motion, useDragControls } from "motion/react"
import { type ReactElement, useState } from "react"

import { Button } from "@v3/_/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@v3/_/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v3/_/components/ui/dialog"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { type HomeSectionKind, type ShelfWithBooks } from "@/database/shelves"
import {
  useDeleteUserShelfMutation,
  useListHomeShelvesQuery,
  useListUserShelvesQuery,
  useSetHomeShelvesMutation,
} from "@/store/api"
import { type UUID } from "@/uuid"

import { ShelfEditor } from "./ShelfEditor"

type ShelfManagerProps = {
  className?: string
  // override the default trigger button (e.g. when opening the home customizer
  // from another menu). nativeButton must stay false for non-button triggers.
  trigger?: ReactElement
}

export function ShelfManager({ className, trigger }: ShelfManagerProps) {
  const t = useTranslation("HomePage")
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        {...(trigger ? { nativeButton: false } : {})}
        render={
          trigger ?? (
            <Button variant="default" size="sm" className={className}>
              <IconSettings className="mr-2 size-4" />
              {t("sections.customize")}
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("sections.title")}</DialogTitle>
          <DialogDescription>{t("sections.description")}</DialogDescription>
        </DialogHeader>
        <ShelfManagerContent
          onClose={() => {
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

type ShelfManagerContentProps = {
  onClose: () => void
}

type LocalHomeShelf = {
  uuid: UUID
  shelfUuid: UUID | null
  kind: HomeSectionKind
  name: string | null
  isNew?: boolean
}

// widgets + built-in shelves, all toggleable/reorderable via the manager.
const BUILT_IN_KINDS: HomeSectionKind[] = [
  "hero",
  "stats",
  "currentlyReading",
  "nextUpInSeries",
  "recentlyAdded",
]

function ShelfManagerContent({ onClose }: ShelfManagerContentProps) {
  const t = useTranslation("HomePage")
  const c = useCommon()
  const { data: homeShelves, isLoading } = useListHomeShelvesQuery()
  const { data: userShelves = [], refetch: refetchUserShelves } =
    useListUserShelvesQuery()
  const [setHomeShelves, { isLoading: isSaving }] = useSetHomeShelvesMutation()
  const [deleteUserShelf] = useDeleteUserShelfMutation()

  const [localShelves, setLocalShelves] = useState<LocalHomeShelf[] | null>(
    null,
  )
  const [hiddenOpen, setHiddenOpen] = useState(false)
  const [shelfEditorOpen, setShelfEditorOpen] = useState(false)
  const [editingShelf, setEditingShelf] = useState<ShelfWithBooks | null>(null)

  const shelves: LocalHomeShelf[] =
    localShelves ??
    (homeShelves ?? []).map((hs) => ({
      uuid: hs.uuid,
      shelfUuid: hs.shelfUuid,
      kind: hs.kind,
      name: hs.name ?? t(`kinds.${hs.kind}.name`),
    }))

  const shownBuiltInTypes = shelves
    .filter((s) => s.kind !== "custom")
    .map((s) => s.kind)

  const shownCustomShelfUuids = shelves
    .filter(
      (s): s is LocalHomeShelf & { shelfUuid: string; kind: "custom" } =>
        s.kind === "custom" && !!s.shelfUuid,
    )
    .map((s) => s.shelfUuid)

  const hiddenBuiltInTypes = BUILT_IN_KINDS.filter(
    (t) => !shownBuiltInTypes.includes(t),
  )

  const hiddenCustomShelves = userShelves.filter(
    (s: ShelfWithBooks) => !shownCustomShelfUuids.includes(s.uuid),
  )

  const hasHiddenShelves =
    hiddenBuiltInTypes.length > 0 || hiddenCustomShelves.length > 0

  const moveShelf = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1

    if (newIndex < 0 || newIndex >= shelves.length) return

    const newShelves = [...shelves]
    const [moved] = newShelves.splice(index, 1)
    if (!moved) return

    newShelves.splice(newIndex, 0, moved)
    setLocalShelves(newShelves)
  }

  const hideShelf = (uuid: string) => {
    if (shelves.length <= 1) return
    setLocalShelves(shelves.filter((s) => s.uuid !== uuid))
  }

  const showBuiltInShelf = (kind: HomeSectionKind) => {
    setLocalShelves([
      ...shelves,
      {
        uuid: crypto.randomUUID() as UUID,
        shelfUuid: null,
        kind,
        name: t(`kinds.${kind}.name`),
      },
    ])
  }

  const showCustomShelf = (userShelf: ShelfWithBooks) => {
    setLocalShelves([
      ...shelves,
      {
        uuid: crypto.randomUUID() as UUID,
        shelfUuid: userShelf.uuid,
        kind: "custom",
        name: userShelf.name,
      },
    ])
  }

  const handleDeleteCustomShelf = async (shelfUuid: string) => {
    await deleteUserShelf({ uuid: shelfUuid })
    void refetchUserShelves()
  }

  const handleSave = async () => {
    const shelvesToSave = shelves.map((shelf) => ({
      shelfUuid: shelf.shelfUuid,
      kind: shelf.kind,
    }))

    await setHomeShelves(shelvesToSave).unwrap()
    setLocalShelves(null)
    onClose()
  }

  const handleCreateNewShelf = () => {
    setEditingShelf(null)
    setShelfEditorOpen(true)
  }

  const handleEditShelf = (shelfUuid: UUID) => {
    const shelf = userShelves.find((s: ShelfWithBooks) => s.uuid === shelfUuid)

    if (shelf) {
      setEditingShelf(shelf)
      setShelfEditorOpen(true)
    }
  }

  const handleShelfSaved = (saved: ShelfWithBooks) => {
    void refetchUserShelves()

    if (!editingShelf) {
      setLocalShelves([
        ...shelves,
        {
          uuid: crypto.randomUUID() as UUID,
          shelfUuid: saved.uuid,
          kind: "custom",
          name: saved.name,
        },
      ])
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <IconLoader2 className="size-6 animate-spin" />
      </div>
    )
  }

  return (
    <>
      <Reorder.Group
        values={shelves}
        onReorder={setLocalShelves}
        className={cn("flex flex-col gap-2")}
      >
        {shelves.map((shelf, index) => (
          <ShelfItem
            key={shelf.uuid}
            shelf={shelf}
            index={index}
            total={shelves.length}
            onMove={(dir) => {
              moveShelf(index, dir)
            }}
            onHide={() => {
              hideShelf(shelf.uuid)
            }}
            canHide={shelves.length > 1}
            {...(shelf.shelfUuid
              ? {
                  onEdit: () => {
                    handleEditShelf(shelf.shelfUuid as UUID)
                  },
                }
              : {})}
          />
        ))}
      </Reorder.Group>

      <Button
        variant="outline"
        onClick={handleCreateNewShelf}
        className="mt-2 w-full"
      >
        <IconPlus className="mr-2 size-4" />
        {t("sections.createNewShelf")}
      </Button>

      {hasHiddenShelves && (
        <Collapsible
          open={hiddenOpen}
          onOpenChange={setHiddenOpen}
          className="mt-4"
        >
          <CollapsibleTrigger
            render={
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-sm"
              >
                <IconChevronRight
                  className={cn(
                    "size-4 transition-transform",
                    hiddenOpen && "rotate-90",
                  )}
                />
                {t("sections.hidden", {
                  count: hiddenBuiltInTypes.length + hiddenCustomShelves.length,
                })}
              </button>
            }
          />

          <CollapsibleContent className="mt-2">
            <div className="flex flex-col gap-2">
              {hiddenBuiltInTypes.map((kind) => (
                <HiddenShelfItem
                  key={kind}
                  name={t(`kinds.${kind}.name`)}
                  description={t(`kinds.${kind}.description`)}
                  onShow={() => {
                    showBuiltInShelf(kind)
                  }}
                />
              ))}

              {hiddenCustomShelves.map((userShelf: ShelfWithBooks) => (
                <HiddenShelfItem
                  key={userShelf.uuid}
                  name={userShelf.name}
                  description={t("sections.customShelf")}
                  onShow={() => {
                    showCustomShelf(userShelf)
                  }}
                  onDelete={() => handleDeleteCustomShelf(userShelf.uuid)}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <ShelfEditor
        open={shelfEditorOpen}
        onOpenChange={setShelfEditorOpen}
        shelf={editingShelf}
        onSaved={handleShelfSaved}
      />

      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          {c("actions.cancel")}
        </Button>

        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <IconLoader2 className="mr-2 size-4 animate-spin" />}
          {t("sections.save")}
        </Button>
      </DialogFooter>
    </>
  )
}

type ShelfItemProps = {
  shelf: LocalHomeShelf
  index: number
  total: number
  onMove: (direction: "up" | "down") => void
  onHide: () => void
  onEdit?: () => void
  canHide: boolean
}

function ShelfItem({
  shelf,
  index,
  total,
  onMove,
  onHide,
  onEdit,
  canHide,
}: ShelfItemProps) {
  const t = useTranslation("HomePage")
  const isBuiltIn = shelf.kind !== "custom"
  const displayName = shelf.name ?? t(`kinds.${shelf.kind}.name`)
  const controls = useDragControls()
  const [isDragging, setIsDragging] = useState(false)

  return (
    <Reorder.Item
      value={shelf}
      className={cn(
        "bg-muted flex items-center gap-2 rounded-lg border p-1.5",
        isDragging && "cursor-grabbing!",
      )}
      dragControls={controls}
      dragListener={false}
    >
      <motion.button
        className={cn(
          "size-8 hover:cursor-grab",
          isDragging && "cursor-grabbing!",
        )}
        onPointerDown={(e) => {
          e.preventDefault()
          setIsDragging(true)
          controls.start(e)
        }}
        onPointerUp={() => {
          setIsDragging(false)
        }}
      >
        <IconGripVertical className="text-muted-foreground size-4 shrink-0" />
      </motion.button>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="text-sm font-medium">{displayName}</div>

        {isBuiltIn && (
          <div className="text-muted-foreground text-xs">
            {t(`kinds.${shelf.kind}.description`)}
          </div>
        )}

        {!isBuiltIn && (
          <div className="text-muted-foreground text-xs">
            {t("sections.customShelf")}
          </div>
        )}
      </div>

      {onEdit && (
        <Button variant="ghost" size="icon-sm" onClick={onEdit}>
          <IconPencil className="size-4" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onHide}
        disabled={!canHide}
        className={cn(!canHide && "invisible")}
        title={t("sections.hideFromHome")}
      >
        <IconEyeOff className="size-4" />
      </Button>

      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            onMove("up")
          }}
          disabled={index === 0}
        >
          <IconChevronUp className="size-3" />
        </Button>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            onMove("down")
          }}
          disabled={index === total - 1}
        >
          <IconChevronDown className="size-3" />
        </Button>
      </div>
    </Reorder.Item>
  )
}

type HiddenShelfItemProps = {
  name: string
  description: string
  onShow: () => void
  onDelete?: () => void
}

function HiddenShelfItem({
  name,
  description,
  onShow,
  onDelete,
}: HiddenShelfItemProps) {
  const t = useTranslation("HomePage")
  return (
    <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-muted-foreground text-xs">{description}</div>
      </div>

      <Button variant="outline" size="sm" onClick={onShow} className="h-7">
        <IconPlus className="mr-1 size-3" />
        {t("sections.show")}
      </Button>

      {onDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
          title={t("sections.deletePermanently")}
        >
          <IconTrash className="size-4" />
        </Button>
      )}
    </div>
  )
}
