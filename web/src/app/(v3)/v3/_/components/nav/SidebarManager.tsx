"use client"

import {
  IconCheck,
  IconChevronDown,
  IconEyeOff,
  IconGripVertical,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react"
import { Reorder, useDragControls } from "motion/react"
import { useState } from "react"

import { ShelfEditor } from "@v3/_/components/shelves/ShelfEditor"
import { Button } from "@v3/_/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@v3/_/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { Input } from "@v3/_/components/ui/input"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@v3/_/components/ui/sidebar"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { type ShelfWithBooks } from "@/database/shelves"
import {
  type SidebarGroupWithItems,
  type SidebarItemKind,
} from "@/database/sidebar"
import {
  useListCollectionsQuery,
  useListUserShelvesQuery,
  useSetSidebarGroupsMutation,
} from "@/store/api"
import { extractEmojiIcon } from "@/strings"

import {
  BUILTIN_SIDEBAR_ITEMS,
  BUILTIN_SIDEBAR_MAP,
  type BuiltinSidebarItem,
} from "./sidebar-items"

type ShelfListItem = {
  uuid: string
  name: string
  icon?: string | null
  color?: string | null
}

type LocalItem = {
  id: string
  kind: SidebarItemKind
  builtinKey: string | null
  collectionUuid: string | null
  shelfUuid: string | null
  name: string
  icon: string | null
  color: string | null
}

type LocalGroup = {
  id: string
  name: string
  collapsed: boolean
  items: LocalItem[]
}

function cleanName(name: string | null | undefined): string {
  return extractEmojiIcon(name ?? "").label || (name ?? "")
}

type SidebarManagerProps = {
  groups: SidebarGroupWithItems[]
  onClose: () => void
}

export function SidebarManager({ groups, onClose }: SidebarManagerProps) {
  const t = useTranslation("SidebarManager")
  const tApp = useTranslation("AppSidebar")
  const tLibrary = useTranslation("LibraryPage")

  const { data: collections = [] } = useListCollectionsQuery()

  // kysely inference loses selectAll fields; the API response has all shelf columns
  const { data: rawShelves = [] } = useListUserShelvesQuery()
  const userShelves = rawShelves as unknown as Array<
    ShelfListItem & ShelfWithBooks
  >
  const [setSidebarGroups, { isLoading: isSaving }] =
    useSetSidebarGroupsMutation()

  // "create" means open the editor in create mode; a uuid string means edit that shelf
  const [shelfEditorState, setShelfEditorState] = useState<string | null>(null)

  const builtinTitle = (builtin: BuiltinSidebarItem) =>
    builtin.labelNs === "AppSidebar"
      ? tApp(builtin.labelKey)
      : tLibrary(builtin.labelKey)

  const [localGroups, setLocalGroups] = useState<LocalGroup[]>(() =>
    groups.map((g) => ({
      id: g.uuid,
      name: g.name,
      collapsed: g.collapsed,
      items: g.items.map((item) => {
        if (item.kind === "builtin" && item.builtinKey) {
          const builtin = BUILTIN_SIDEBAR_MAP[item.builtinKey]
          return {
            id: `builtin:${item.builtinKey}`,
            kind: "builtin" as const,
            builtinKey: item.builtinKey,
            collectionUuid: null,
            shelfUuid: null,
            name: builtin ? builtinTitle(builtin) : item.builtinKey,
            icon: null,
            color: null,
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
            icon: item.icon ?? null,
            color: item.color ?? null,
          }
        }

        return {
          id: `shelf:${item.shelfUuid}`,
          kind: "shelf" as const,
          builtinKey: null,
          collectionUuid: null,
          shelfUuid: item.shelfUuid,
          name: cleanName(item.name),
          icon: item.icon ?? null,
          color: item.color ?? null,
        }
      }),
    })),
  )

  const allShownItems = localGroups.flatMap((g) => g.items)
  const shownBuiltinKeys = allShownItems
    .filter((i) => i.kind === "builtin")
    .map((i) => i.builtinKey)
  const shownCollectionUuids = allShownItems
    .filter((i) => i.kind === "collection")
    .map((i) => i.collectionUuid)
  const shownShelfUuids = allShownItems
    .filter((i) => i.kind === "shelf")
    .map((i) => i.shelfUuid)

  const availableBuiltins = BUILTIN_SIDEBAR_ITEMS.filter(
    (b) => !shownBuiltinKeys.includes(b.key),
  )
  const availableCollections = collections.filter(
    (c) => !shownCollectionUuids.includes(c.uuid),
  )
  const availableShelves = userShelves.filter(
    (s) => !shownShelfUuids.includes(s.uuid),
  )

  const hasAvailable =
    availableBuiltins.length > 0 ||
    availableCollections.length > 0 ||
    availableShelves.length > 0

  const updateGroup = (
    groupId: string,
    updater: (g: LocalGroup) => LocalGroup,
  ) => {
    setLocalGroups((prev) =>
      prev.map((g) => (g.id === groupId ? updater(g) : g)),
    )
  }

  const removeItem = (groupId: string, itemId: string) => {
    updateGroup(groupId, (g) => ({
      ...g,
      items: g.items.filter((i) => i.id !== itemId),
    }))
  }

  const addItem = (groupId: string, item: LocalItem) => {
    updateGroup(groupId, (g) => ({
      ...g,
      items: [...g.items, item],
    }))
  }

  const updateItem = (groupId: string, item: LocalItem) => {
    updateGroup(groupId, (g) => ({
      ...g,
      items: g.items.map((i) => (i.id === item.id ? item : i)),
    }))
  }

  const addGroup = () => {
    setLocalGroups((prev) => [
      ...prev,
      {
        id: `new:${crypto.randomUUID()}`,
        name: "New Section",
        collapsed: false,
        items: [],
      },
    ])
  }

  const removeGroup = (groupId: string) => {
    setLocalGroups((prev) => prev.filter((g) => g.id !== groupId))
  }

  const handleShelfSaved = (rawSaved: ShelfWithBooks) => {
    // kysely inference loses fields; cast to access runtime properties
    const saved = rawSaved as unknown as ShelfListItem

    const isCreating = shelfEditorState === "create"
    const itemPayload: LocalItem = {
      id: `shelf:${saved.uuid}`,
      kind: "shelf",
      builtinKey: null,
      collectionUuid: null,
      shelfUuid: saved.uuid,
      name: cleanName(saved.name),
      icon: saved.icon ?? null,
      color: saved.color ?? null,
    }

    if (isCreating) {
      const lastGroup = localGroups[localGroups.length - 1]
      if (!lastGroup) return
      addItem(lastGroup.id, itemPayload)
    } else {
      for (const g of localGroups) {
        const existing = g.items.find((i) => i.shelfUuid === saved.uuid)
        if (existing) {
          updateItem(g.id, itemPayload)
          break
        }
      }
    }
  }

  const handleSave = async () => {
    await setSidebarGroups(
      localGroups.map((g) => ({
        uuid: g.id.startsWith("new:") ? undefined : g.id,
        name: g.name,
        collapsed: g.collapsed,
        items: g.items.map((i) => ({
          kind: i.kind,
          builtinKey: i.kind === "builtin" ? i.builtinKey : undefined,
          collectionUuid:
            i.kind === "collection" ? i.collectionUuid : undefined,
          shelfUuid: i.kind === "shelf" ? i.shelfUuid : undefined,
        })),
      })),
    ).unwrap()

    onClose()
  }

  return (
    <>
      <SidebarGroup className="flex-1 overflow-y-auto">
        <SidebarGroupLabel className="flex items-center justify-between">
          <span className="font-sans text-[10px] font-medium tracking-[0.14em] uppercase opacity-60">
            {t("title")}
          </span>

          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              disabled={isSaving}
              title={t("cancel")}
              className="text-muted-foreground hover:text-foreground size-5"
            >
              <IconX className="size-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleSave}
              disabled={isSaving}
              title={t("save")}
              className="text-muted-foreground hover:text-foreground size-5"
            >
              {isSaving ? (
                <IconLoader2 className="size-3.5 animate-spin" />
              ) : (
                <IconCheck className="size-3.5" />
              )}
            </Button>
          </div>
        </SidebarGroupLabel>

        <SidebarGroupContent>
          <div className="flex flex-col gap-3 px-1">
            {localGroups.map((group) => (
              <EditableGroup
                key={group.id}
                group={group}
                onRename={(name) => {
                  updateGroup(group.id, (g) => ({ ...g, name }))
                }}
                onRemoveGroup={() => {
                  removeGroup(group.id)
                }}
                onRemoveItem={(itemId) => {
                  removeItem(group.id, itemId)
                }}
                onReorderItems={(items) => {
                  updateGroup(group.id, (g) => ({ ...g, items }))
                }}
                showAdd={hasAvailable}
                availableBuiltins={availableBuiltins}
                availableCollections={availableCollections}
                availableShelves={availableShelves}
                onAddItem={(item) => {
                  addItem(group.id, item)
                }}
                builtinTitle={builtinTitle}
                t={t as unknown as (key: string) => string}
                canEditItem={(item) => {
                  return item.kind === "shelf" && item.shelfUuid !== null
                }}
                onEditItem={(item) => {
                  if (item.kind === "shelf" && item.shelfUuid) {
                    setShelfEditorState(item.shelfUuid)
                  }
                }}
              />
            ))}

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-muted-foreground text-muted-foreground hover:text-foreground flex-1 text-xs"
                onClick={addGroup}
              >
                <IconPlus className="mr-1 size-3" />
                {t("addGroup")}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="border-muted-foreground text-muted-foreground hover:text-foreground flex-1 text-xs"
                onClick={() => {
                  setShelfEditorState("create")
                }}
              >
                <IconPlus className="mr-1 size-3" />
                {t("createShelf")}
              </Button>
            </div>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>

      <ShelfEditor
        open={!!shelfEditorState}
        onOpenChange={(open) => {
          if (!open) {
            setShelfEditorState(null)
          }
        }}
        shelf={
          shelfEditorState && shelfEditorState !== "create"
            ? userShelves.find((s) => s.uuid === shelfEditorState) ?? null
            : null
        }
        onSaved={handleShelfSaved}
      />
    </>
  )
}

type EditableGroupProps = {
  group: LocalGroup
  onRename: (name: string) => void
  onRemoveGroup: () => void
  onRemoveItem: (itemId: string) => void
  onEditItem: (item: LocalItem) => void
  onReorderItems: (items: LocalItem[]) => void
  showAdd: boolean
  availableBuiltins: BuiltinSidebarItem[]
  availableCollections: Array<{ uuid: string; name: string }>
  availableShelves: ShelfListItem[]
  onAddItem: (item: LocalItem) => void
  builtinTitle: (b: BuiltinSidebarItem) => string
  t: (key: string) => string
  canEditItem: (item: LocalItem) => boolean
}

function EditableGroup({
  group,
  onRename,
  onRemoveGroup,
  onRemoveItem,
  onEditItem,
  onReorderItems,
  showAdd,
  availableBuiltins,
  availableCollections,
  availableShelves,
  onAddItem,
  builtinTitle,
  t,
  canEditItem,
}: EditableGroupProps) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <CollapsibleTrigger
            render={
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground flex size-5 items-center justify-center"
              >
                <IconChevronDown
                  className={cn(
                    "size-3 transition-transform",
                    !isOpen && "-rotate-90",
                  )}
                />
              </button>
            }
          />

          <Input
            value={group.name}
            onChange={(e) => {
              onRename(e.target.value)
            }}
            className="h-6 flex-1 border-none bg-transparent px-1 text-xs font-medium shadow-none focus-visible:ring-1"
          />

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onRemoveGroup}
            className="text-muted-foreground hover:text-destructive hover:bg-muted-foreground size-5"
            title="Remove group"
          >
            <IconTrash className="size-3" />
          </Button>
        </div>

        <CollapsibleContent>
          <Reorder.Group
            values={group.items}
            onReorder={onReorderItems}
            className="flex flex-col gap-0.5"
          >
            {group.items.map((item) => (
              <EditableItem
                key={item.id}
                item={item}
                onRemove={() => {
                  onRemoveItem(item.id)
                }}
                onEdit={
                  canEditItem(item)
                    ? () => {
                        onEditItem(item)
                      }
                    : undefined
                }
              />
            ))}
          </Reorder.Group>

          {showAdd && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground mt-1 ml-5 flex items-center gap-1 text-xs"
                  >
                    <IconPlus className="size-3" />
                    {t("add")}
                  </button>
                }
              />

              <DropdownMenuContent side="bottom" align="start">
                {availableBuiltins.length > 0 && (
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Pages</DropdownMenuLabel>
                    {availableBuiltins.map((b) => (
                      <DropdownMenuItem
                        key={b.key}
                        onClick={() => {
                          onAddItem({
                            id: `builtin:${b.key}`,
                            kind: "builtin",
                            builtinKey: b.key,
                            collectionUuid: null,
                            shelfUuid: null,
                            name: builtinTitle(b),
                            icon: null,
                            color: null,
                          })
                        }}
                      >
                        {builtinTitle(b)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                )}

                {availableCollections.length > 0 && (
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("collection")}</DropdownMenuLabel>
                    {availableCollections.map((c) => (
                      <DropdownMenuItem
                        key={c.uuid}
                        onClick={() => {
                          onAddItem({
                            id: `collection:${c.uuid}`,
                            kind: "collection",
                            builtinKey: null,
                            collectionUuid: c.uuid,
                            shelfUuid: null,
                            name: cleanName(c.name),
                            icon: null,
                            color: null,
                          })
                        }}
                      >
                        {cleanName(c.name)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                )}

                {availableShelves.length > 0 && (
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("shelf")}</DropdownMenuLabel>
                    {availableShelves.map((s) => (
                      <DropdownMenuItem
                        key={s.uuid}
                        onClick={() => {
                          onAddItem({
                            id: `shelf:${s.uuid}`,
                            kind: "shelf",
                            builtinKey: null,
                            collectionUuid: null,
                            shelfUuid: s.uuid,
                            name: cleanName(s.name),
                            icon: s.icon ?? null,
                            color: s.color ?? null,
                          })
                        }}
                      >
                        {cleanName(s.name)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

type EditableItemProps = {
  item: LocalItem
  onRemove: () => void
  onEdit?: () => void
}

function EditableItem({ item, onRemove, onEdit }: EditableItemProps) {
  const controls = useDragControls()
  const [isDragging, setIsDragging] = useState(false)

  return (
    <Reorder.Item
      value={item}
      className={cn(
        "flex items-center gap-1 rounded px-0.5 py-0.5",
        isDragging && "bg-muted-foreground cursor-grabbing!",
      )}
      dragControls={controls}
      dragListener={false}
    >
      <button
        type="button"
        className={cn(
          "text-muted-foreground flex size-4 shrink-0 items-center justify-center hover:cursor-grab",
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
        <IconGripVertical className="size-3" />
      </button>

      <span className="flex-1 truncate text-xs">{item.name}</span>

      {onEdit && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onEdit}
          className="text-muted-foreground hover:text-foreground hover:bg-muted-foreground size-4"
          title="Edit"
        >
          <IconPencil className="size-3" />
        </Button>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive flex size-4 shrink-0 items-center justify-center"
        title="Hide"
      >
        <IconEyeOff className="size-3" />
      </button>
    </Reorder.Item>
  )
}
