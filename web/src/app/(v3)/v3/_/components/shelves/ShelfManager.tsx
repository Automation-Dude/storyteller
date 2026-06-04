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
import { Reorder, motion, useDragControls  } from "framer-motion"
import { useState } from "react"

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
import { cn } from "@v3/_/lib/utils"

import { type HomeShelfType, type ShelfWithBooks } from "@/database/shelves"
import {
  useDeleteUserShelfMutation,
  useListHomeShelvesQuery,
  useListUserShelvesQuery,
  useSetHomeShelvesMutation,
} from "@/store/api"

import { ShelfEditor } from "./ShelfEditor"

type ShelfManagerProps = {
  className?: string
}

export function ShelfManager({ className }: ShelfManagerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className={className}>
            <IconSettings className="mr-2 size-4" />
            Customize
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Customize Home Shelves</DialogTitle>
          <DialogDescription>
            Add, remove, and reorder the shelves shown on your home page.
          </DialogDescription>
        </DialogHeader>
        <ShelfManagerContent onClose={() => { setOpen(false); }} />
      </DialogContent>
    </Dialog>
  )
}

type ShelfManagerContentProps = {
  onClose: () => void
}

type LocalHomeShelf = {
  uuid: string
  shelfUuid: string | null
  shelfType: HomeShelfType
  name: string | null
  isNew?: boolean
}

const BUILT_IN_SHELF_TYPES: HomeShelfType[] = [
  "currentlyReading",
  "nextUpInSeries",
  "recentlyAdded",
]

function ShelfManagerContent({ onClose }: ShelfManagerContentProps) {
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
    (homeShelves ?? []).map(
      (hs: {
        uuid: string
        shelfUuid: string | null
        shelfType: HomeShelfType
        name: string | null
      }) => ({
        uuid: hs.uuid,
        shelfUuid: hs.shelfUuid,
        shelfType: hs.shelfType,
        name: hs.name ?? getDefaultName(hs.shelfType),
      }),
    )

  const shownBuiltInTypes = shelves
    .filter((s) => s.shelfType !== "custom")
    .map((s) => s.shelfType)

  const shownCustomShelfUuids = shelves
    .filter((s) => s.shelfType === "custom" && s.shelfUuid)
    .map((s) => s.shelfUuid!)

  const hiddenBuiltInTypes = BUILT_IN_SHELF_TYPES.filter(
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

  const showBuiltInShelf = (shelfType: HomeShelfType) => {
    setLocalShelves([
      ...shelves,
      {
        uuid: crypto.randomUUID(),
        shelfUuid: null,
        shelfType,
        name: getDefaultName(shelfType),
      },
    ])
  }

  const showCustomShelf = (userShelf: ShelfWithBooks) => {
    setLocalShelves([
      ...shelves,
      {
        uuid: crypto.randomUUID(),
        shelfUuid: userShelf.uuid,
        shelfType: "custom",
        name: userShelf.name,
      },
    ])
  }

  const handleDeleteCustomShelf = async (shelfUuid: string) => {
    await deleteUserShelf({ uuid: shelfUuid })
    refetchUserShelves()
  }

  const handleSave = async () => {
    const shelvesToSave: Array<{
      shelfUuid?: string | null
      shelfType: HomeShelfType
    }> = shelves.map((shelf) => ({
      shelfUuid: shelf.shelfUuid,
      shelfType: shelf.shelfType,
    }))

    await setHomeShelves(shelvesToSave).unwrap()
    setLocalShelves(null)
    onClose()
  }

  const handleCreateNewShelf = () => {
    setEditingShelf(null)
    setShelfEditorOpen(true)
  }

  const handleEditShelf = (shelfUuid: string) => {
    const shelf = userShelves.find((s: ShelfWithBooks) => s.uuid === shelfUuid)

    if (shelf) {
      setEditingShelf(shelf)
      setShelfEditorOpen(true)
    }
  }

  const handleShelfSaved = (saved: ShelfWithBooks) => {
    refetchUserShelves()

    if (!editingShelf) {
      setLocalShelves([
        ...shelves,
        {
          uuid: crypto.randomUUID(),
          shelfUuid: saved.uuid,
          shelfType: "custom",
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
            onMove={(dir) => { moveShelf(index, dir); }}
            onHide={() => { hideShelf(shelf.uuid); }}
            canHide={shelves.length > 1}
            {...(shelf.shelfUuid
              ? { onEdit: () => { handleEditShelf(shelf.shelfUuid!); } }
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
        Create New Shelf
      </Button>

      {hasHiddenShelves && (
        <Collapsible
          open={hiddenOpen}
          onOpenChange={setHiddenOpen}
          className="mt-4"
        >
          <CollapsibleTrigger asChild>
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
              Hidden Shelves (
              {hiddenBuiltInTypes.length + hiddenCustomShelves.length})
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-2">
            <div className="flex flex-col gap-2">
              {hiddenBuiltInTypes.map((shelfType) => (
                <HiddenShelfItem
                  key={shelfType}
                  name={getDefaultName(shelfType)}
                  description={getShelfDescription(shelfType)}
                  onShow={() => { showBuiltInShelf(shelfType); }}
                />
              ))}

              {hiddenCustomShelves.map((userShelf: ShelfWithBooks) => (
                <HiddenShelfItem
                  key={userShelf.uuid}
                  name={userShelf.name}
                  description="Custom shelf"
                  onShow={() => { showCustomShelf(userShelf); }}
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
          Cancel
        </Button>

        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <IconLoader2 className="mr-2 size-4 animate-spin" />}
          Save Changes
        </Button>
      </DialogFooter>
    </>
  )
}

function getDefaultName(shelfType: HomeShelfType): string {
  switch (shelfType) {
    case "currentlyReading":
      return "Currently Reading"
    case "nextUpInSeries":
      return "Next Up in Series"
    case "recentlyAdded":
      return "Recently Added"
    case "custom":
      return "Custom Shelf"
  }
}

function getShelfDescription(shelfType: HomeShelfType): string {
  switch (shelfType) {
    case "currentlyReading":
      return "Shows books with 'Reading' status"
    case "nextUpInSeries":
      return "Shows next unread books in series you've started"
    case "recentlyAdded":
      return "Shows recently added books"
    case "custom":
      return "Custom shelf"
  }
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
  const isBuiltIn = shelf.shelfType !== "custom"
  const displayName = shelf.name ?? getDefaultName(shelf.shelfType)
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
            {getShelfDescription(shelf.shelfType)}
          </div>
        )}

        {!isBuiltIn && (
          <div className="text-muted-foreground text-xs">Custom shelf</div>
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
        title="Hide from home"
      >
        <IconEyeOff className="size-4" />
      </Button>

      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => { onMove("up"); }}
          disabled={index === 0}
        >
          <IconChevronUp className="size-3" />
        </Button>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => { onMove("down"); }}
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
  return (
    <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-muted-foreground text-xs">{description}</div>
      </div>

      <Button variant="outline" size="sm" onClick={onShow} className="h-7">
        <IconPlus className="mr-1 size-3" />
        Show
      </Button>

      {onDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
          title="Delete shelf permanently"
        >
          <IconTrash className="size-4" />
        </Button>
      )}
    </div>
  )
}
