"use client"

import { IconPlus, IconX } from "@tabler/icons-react"
import { type ReactNode, useCallback, useMemo, useState } from "react"

import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import { DynamicIcon } from "@v3/_/components/ui/dynamic-icon"
import { Input } from "@v3/_/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@v3/_/components/ui/popover"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import { V3Link } from "@/app/(v3)/v3/_/components/v3-link"

import { useCoverColors } from "./BookDetails/sections/useCoverColors"
import { Skeleton } from "@mantine/core"

type RelationItem = {
  uuid: string
  name: string
  url?: string
  // optional icon id (resolved via DynamicIcon) and color, e.g. for tags/collections
  icon?: string | null
  color?: string | null
}

// the icon (or a color dot fallback) shown at the start of an item, when set
export const RelationGlyph = ({ item }: { item: RelationItem }) => {
  if (item.icon) {
    return (
      <DynamicIcon iconId={item.icon} color={item.color} className="h-3 w-3" />
    )
  }
  if (item.color) {
    return (
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: item.color }}
      />
    )
  }
  return null
}

type RelationChipEditorProps<T extends RelationItem> = {
  isLoading: boolean
  onOpenChange: (open: boolean) => void
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

const RelationChip = ({
  item,
  badgeVariant,
  canInteract,
  onRemoveItem,
  renderBadgeExtra,
  label,
}: {
  item: RelationItem
  badgeVariant: "outline" | "secondary"
  canInteract: boolean
  onRemoveItem: (item: RelationItem) => void
  renderBadgeExtra?: (item: RelationItem) => ReactNode
  label: string
}) => {
  const base = (
    <>
      <RelationGlyph item={item} />
      {item.name}
      {renderBadgeExtra?.(item)}

      {canInteract && (
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={label}
          onClick={(e) => {
            e.preventDefault()
            onRemoveItem(item)
          }}
          className="absolute top-[55%] -right-0.5 z-20 -translate-y-1/2 rounded-full opacity-0 transition-opacity group-hover/badge:opacity-100"
        >
          <IconX className="h-3 w-3" />
        </Button>
      )}
    </>
  )

  if (item.url) {
    return (
      <Badge
        variant={badgeVariant}
        className={cn(
          "group/badge relative h-5 gap-0.5 px-3 font-normal transition-all hover:pr-4",
        )}
        render={
          <V3Link
            href={item.url}
            className="hover:text-primary hover:underline has-[button:hover]:no-underline"
          >
            {base}
          </V3Link>
        }
      />
    )
  }
  return (
    <Badge
      variant={badgeVariant}
      className={cn(
        "group/badge relative gap-0.5 px-4 font-normal transition-all hover:pr-4",
      )}
    >
      {base}
    </Badge>
  )
}

export function RelationChipEditor<T extends RelationItem>({
  isLoading,
  onOpenChange,
  items,
  allItems,
  icon: _Icon,
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
  const tLabels = useTranslation("Labels")
  const c = useCommon()

  const [search, setSearch] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      onOpenChange(open)
    },
    [onOpenChange],
  )
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
      {items.map((item, idx) => (
        <RelationChip
          key={`${item.uuid}-${idx}`}
          item={item}
          badgeVariant={badgeVariant}
          canInteract={canInteract}
          onRemoveItem={() => void onRemoveItem(item)}
          renderBadgeExtra={
            renderBadgeExtra as (item: RelationItem) => ReactNode
          }
          label={tLabels("delete.withInput", { input: item.name })}
        />
      ))}

      {items.length === 0 && (
        <span className="text-muted-foreground text-sm">{emptyText}</span>
      )}
    </div>
  )
}
