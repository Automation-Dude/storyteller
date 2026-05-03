"use client"

import { IconPlus, IconX } from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { type ReactNode, useMemo, useState } from "react"

import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import { Input } from "@v3/_/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@v3/_/components/ui/popover"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { cn } from "@v3/_/lib/utils"

type RelationItem = {
  uuid: string
  name: string
}

type RelationChipEditorProps<T extends RelationItem> = {
  items: T[]
  allItems: RelationItem[]

  icon: React.ComponentType<{ className?: string }>
  badgeVariant?: "outline" | "secondary"
  groupName: string

  editMode: boolean
  searchPlaceholder: string
  emptyText: string

  onSelectItem: (item: RelationItem) => void | Promise<void>
  onRemoveItem: (item: T) => void | Promise<void>

  canCreateInline?: boolean
  onCreateInline?: (name: string) => void | Promise<void>

  renderCreateAction?: (search: string, closePopover: () => void) => ReactNode

  renderBadgeExtra?: (item: T) => ReactNode
}

export function RelationChipEditor<T extends RelationItem>({
  items,
  allItems,
  icon: Icon,
  badgeVariant = "outline",
  groupName,
  editMode,
  searchPlaceholder,
  emptyText,
  onSelectItem,
  onRemoveItem,
  canCreateInline = false,
  onCreateInline,
  renderCreateAction,
  renderBadgeExtra,
}: RelationChipEditorProps<T>) {
  const isMobile = useIsMobile()
  const tLabels = useTranslations("Labels")

  const [search, setSearch] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  // keep interaction alive while popover is open
  const canInteract = editMode || isOpen || (!isMobile && isHovering)

  const itemUuids = useMemo(
    () => new Set(items.map((item) => item.uuid)),
    [items],
  )

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase()
    return allItems.filter(
      (item) =>
        !itemUuids.has(item.uuid) && item.name.toLowerCase().includes(term),
    )
  }, [allItems, itemUuids, search])

  const showCreateInline =
    canCreateInline &&
    search.trim() &&
    !allItems.some((item) => item.name === search.trim())

  const handleSelect = (item: RelationItem) => {
    void onSelectItem(item)
    setSearch("")
    setIsOpen(false)
  }

  const handleCreate = () => {
    if (!onCreateInline || !search.trim()) {
      return
    }

    void onCreateInline(search.trim())
    setSearch("")
    setIsOpen(false)
  }

  return (
    <div
      className={cn(`group/${groupName}`, "flex flex-wrap items-center gap-2")}
      onMouseEnter={() => {
        setIsHovering(true)
      }}
      onMouseLeave={() => {
        setIsHovering(false)
      }}
    >
      {items.map((item) => (
        <Badge
          key={item.uuid}
          variant={badgeVariant}
          className={cn("group/badge gap-0.5 font-normal transition-all")}
        >
          {/* <Icon className="h-3 w-3" /> */}
          {item.name}
          {renderBadgeExtra?.(item)}

          {canInteract && (
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={tLabels("delete.withInput", { input: item.name })}
              onClick={() => void onRemoveItem(item)}
              className="rounded-full"
            >
              <IconX className="h-3 w-3" />
            </Button>
          )}
        </Badge>
      ))}

      {items.length === 0 && !canInteract && (
        <span className="text-muted-foreground text-sm">{emptyText}</span>
      )}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "border-border text-muted-foreground h-5 rounded-full border border-dashed text-xs transition-opacity",
              )}
            >
              <IconPlus className="h-3 w-3" />
              Add
            </Button>
          }
        />

        <PopoverContent className="w-64 p-2" align="start">
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !search.trim()) {
                return
              }

              if (canCreateInline) {
                handleCreate()
              }
            }}
          />

          <div className="scroll-y flex max-h-48 flex-col gap-0.5">
            {filteredItems.map((item) => (
              <button
                key={item.uuid}
                type="button"
                aria-label={tLabels("add.withInput", { input: item.name })}
                onClick={() => {
                  handleSelect(item)
                }}
                className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs"
              >
                {item.name}
              </button>
            ))}

            {showCreateInline && (
              <button
                type="button"
                aria-label={tLabels("create.withInput", {
                  input: `"${search.trim()}"`,
                })}
                onClick={handleCreate}
                className="hover:bg-accent text-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs"
              >
                <IconPlus className="h-3 w-3" />
                {tLabels("create.withInput", {
                  input: `"${search.trim()}"`,
                })}
              </button>
            )}

            {renderCreateAction?.(search, () => {
              setIsOpen(false)
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
