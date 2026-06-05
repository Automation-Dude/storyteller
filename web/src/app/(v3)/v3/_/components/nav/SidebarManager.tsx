"use client"

import {
  IconAdjustmentsHorizontal,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconEyeOff,
  IconGripVertical,
  IconLoader2,
  IconPlus,
} from "@tabler/icons-react"
import { Reorder, motion, useDragControls } from "framer-motion"
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
import { SidebarMenuButton, SidebarMenuItem } from "@v3/_/components/ui/sidebar"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { type ShelfWithBooks } from "@/database/shelves"
import { type SidebarItemKind } from "@/database/sidebar"
import {
  useListCollectionsQuery,
  useListSidebarQuery,
  useListUserShelvesQuery,
  useSetSidebarMutation,
} from "@/store/api"
import { extractEmojiIcon } from "@/strings"

import {
  BUILTIN_SIDEBAR_ITEMS,
  BUILTIN_SIDEBAR_MAP,
  type BuiltinSidebarItem,
} from "./sidebar-items"

// local representation of a shown sidebar entry. `id` is a stable reorder key.
type LocalItem = {
  id: string
  kind: SidebarItemKind
  builtinKey: string | null
  collectionUuid: string | null
  shelfUuid: string | null
  name: string
}

function cleanName(name: string | null | undefined): string {
  return extractEmojiIcon(name ?? "").label || (name ?? "")
}

export function SidebarManager() {
  const t = useTranslation("SidebarManager")
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <SidebarMenuItem>
            <SidebarMenuButton size="sm">
              <IconAdjustmentsHorizontal />
              <span>{t("customize")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <SidebarManagerContent
          onClose={() => {
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function SidebarManagerContent({ onClose }: { onClose: () => void }) {
  const t = useTranslation("SidebarManager")
  const tApp = useTranslation("AppSidebar")
  const tLibrary = useTranslation("LibraryPage")

  const { data: sidebarItems, isLoading } = useListSidebarQuery()
  const { data: collections = [] } = useListCollectionsQuery()
  const { data: userShelves = [] } = useListUserShelvesQuery()
  const [setSidebar, { isLoading: isSaving }] = useSetSidebarMutation()

  const [local, setLocal] = useState<LocalItem[] | null>(null)
  const [availableOpen, setAvailableOpen] = useState(false)

  const builtinTitle = (builtin: BuiltinSidebarItem) =>
    builtin.labelNs === "AppSidebar"
      ? tApp(builtin.labelKey)
      : tLibrary(builtin.labelKey)

  const items: LocalItem[] =
    local ??
    (sidebarItems ?? []).map((item) => {
      if (item.kind === "builtin" && item.builtinKey) {
        const builtin = BUILTIN_SIDEBAR_MAP[item.builtinKey]
        return {
          id: `builtin:${item.builtinKey}`,
          kind: "builtin" as const,
          builtinKey: item.builtinKey,
          collectionUuid: null,
          shelfUuid: null,
          name: builtin ? builtinTitle(builtin) : item.builtinKey,
        }
      }

      if (item.kind === "collection") {
        return {
          id: `collection:${item.collectionUuid}`,
          kind: "collection" as const,
          builtinKey: null,
          collectionUuid: item.collectionUuid,
          shelfUuid: null,
          name: cleanName(item.name),
        }
      }

      return {
        id: `shelf:${item.shelfUuid}`,
        kind: "shelf" as const,
        builtinKey: null,
        collectionUuid: null,
        shelfUuid: item.shelfUuid,
        name: cleanName(item.name),
      }
    })

  const shownBuiltinKeys = items
    .filter((i) => i.kind === "builtin")
    .map((i) => i.builtinKey)
  const shownCollectionUuids = items
    .filter((i) => i.kind === "collection")
    .map((i) => i.collectionUuid)
  const shownShelfUuids = items
    .filter((i) => i.kind === "shelf")
    .map((i) => i.shelfUuid)

  const availableBuiltins = BUILTIN_SIDEBAR_ITEMS.filter(
    (b) => !shownBuiltinKeys.includes(b.key),
  )
  const availableCollections = collections.filter(
    (c) => !shownCollectionUuids.includes(c.uuid),
  )
  const availableShelves = userShelves.filter(
    (s: ShelfWithBooks) => !shownShelfUuids.includes(s.uuid),
  )

  const hasAvailable =
    availableBuiltins.length > 0 ||
    availableCollections.length > 0 ||
    availableShelves.length > 0

  const move = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= items.length) return

    const next = [...items]
    const [moved] = next.splice(index, 1)
    if (!moved) return
    next.splice(newIndex, 0, moved)
    setLocal(next)
  }

  const hide = (id: string) => {
    if (items.length <= 1) return
    setLocal(items.filter((i) => i.id !== id))
  }

  const add = (item: LocalItem) => {
    setLocal([...items, item])
  }

  const handleSave = async () => {
    await setSidebar(
      items.map((i) => ({
        kind: i.kind,
        builtinKey: i.kind === "builtin" ? i.builtinKey : undefined,
        collectionUuid: i.kind === "collection" ? i.collectionUuid : undefined,
        shelfUuid: i.kind === "shelf" ? i.shelfUuid : undefined,
      })),
    ).unwrap()
    setLocal(null)
    onClose()
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
        values={items}
        onReorder={setLocal}
        className="flex flex-col gap-2"
      >
        {items.map((item, index) => (
          <SidebarManagerItem
            key={item.id}
            item={item}
            index={index}
            total={items.length}
            onMove={(dir) => {
              move(index, dir)
            }}
            onHide={() => {
              hide(item.id)
            }}
            canHide={items.length > 1}
          />
        ))}
      </Reorder.Group>

      {hasAvailable && (
        <Collapsible
          open={availableOpen}
          onOpenChange={setAvailableOpen}
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
                    availableOpen && "rotate-90",
                  )}
                />
                {t("available")}
              </button>
            }
          />

          <CollapsibleContent className="mt-2">
            <div className="flex flex-col gap-2">
              {availableBuiltins.map((b) => (
                <AvailableItem
                  key={`builtin:${b.key}`}
                  name={builtinTitle(b)}
                  detail={null}
                  onAdd={() => {
                    add({
                      id: `builtin:${b.key}`,
                      kind: "builtin",
                      builtinKey: b.key,
                      collectionUuid: null,
                      shelfUuid: null,
                      name: builtinTitle(b),
                    })
                  }}
                />
              ))}

              {availableCollections.map((c) => (
                <AvailableItem
                  key={`collection:${c.uuid}`}
                  name={cleanName(c.name)}
                  detail={t("collection")}
                  onAdd={() => {
                    add({
                      id: `collection:${c.uuid}`,
                      kind: "collection",
                      builtinKey: null,
                      collectionUuid: c.uuid,
                      shelfUuid: null,
                      name: cleanName(c.name),
                    })
                  }}
                />
              ))}

              {availableShelves.map((s: ShelfWithBooks) => (
                <AvailableItem
                  key={`shelf:${s.uuid}`}
                  name={cleanName(s.name)}
                  detail={t("shelf")}
                  onAdd={() => {
                    add({
                      id: `shelf:${s.uuid}`,
                      kind: "shelf",
                      builtinKey: null,
                      collectionUuid: null,
                      shelfUuid: s.uuid,
                      name: cleanName(s.name),
                    })
                  }}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          {t("cancel")}
        </Button>

        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <IconLoader2 className="mr-2 size-4 animate-spin" />}
          {t("save")}
        </Button>
      </DialogFooter>
    </>
  )
}

type SidebarManagerItemProps = {
  item: LocalItem
  index: number
  total: number
  onMove: (direction: "up" | "down") => void
  onHide: () => void
  canHide: boolean
}

function SidebarManagerItem({
  item,
  index,
  total,
  onMove,
  onHide,
  canHide,
}: SidebarManagerItemProps) {
  const t = useTranslation("SidebarManager")
  const controls = useDragControls()
  const [isDragging, setIsDragging] = useState(false)

  const detail =
    item.kind === "collection"
      ? t("collection")
      : item.kind === "shelf"
        ? t("shelf")
        : null

  return (
    <Reorder.Item
      value={item}
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
        <div className="text-sm font-medium">{item.name}</div>
        {detail && (
          <div className="text-muted-foreground text-xs">{detail}</div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onHide}
        disabled={!canHide}
        className={cn(!canHide && "invisible")}
        title={t("hideFromSidebar")}
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

type AvailableItemProps = {
  name: string
  detail: string | null
  onAdd: () => void
}

function AvailableItem({ name, detail, onAdd }: AvailableItemProps) {
  const t = useTranslation("SidebarManager")
  return (
    <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="text-sm font-medium">{name}</div>
        {detail && (
          <div className="text-muted-foreground text-xs">{detail}</div>
        )}
      </div>

      <Button variant="outline" size="sm" onClick={onAdd} className="h-7">
        <IconPlus className="mr-1 size-3" />
        {t("add")}
      </Button>
    </div>
  )
}
