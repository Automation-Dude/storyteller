"use client"

import { IconX } from "@tabler/icons-react"
import { type ReactNode, useState } from "react"

import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import { DynamicIcon } from "@v3/_/components/ui/dynamic-icon"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { V3Link } from "@/app/(v3)/v3/_/components/v3-link"

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

type RelationChipEditorProps<T extends RelationItem> = {
  items: T[]
  badgeVariant?: "outline" | "secondary"
  source: "tags" | "collections" | "series" | "creators" | "statuses"

  editMode: boolean
  emptyText: string

  onRemoveItem: (item: T) => void | Promise<void>
  renderBadgeExtra?: (item: T) => ReactNode
  children?: ReactNode
  canInteract: boolean
}

export function RelationChipEditor<T extends RelationItem>({
  items,
  badgeVariant = "outline",
  emptyText,
  source,
  onRemoveItem,
  renderBadgeExtra,
  children,
  canInteract,
}: RelationChipEditorProps<T>) {
  const tLabels = useTranslation("Labels")
  const [isHovering, setIsHovering] = useState(false)

  return (
    <div
      className={cn(`group/${source}`, "flex flex-wrap items-center gap-2")}
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

      {children}
    </div>
  )
}
