"use client"

import { type MouseEvent } from "react"

import { Checkbox } from "@v3/_/components/ui/checkbox"

import { cn } from "@/cn"
import * as icon from "@/icons"

// the selection affordance shared by BookCard (grid) and BookListItem (list) so
// both render identically. shift-click extends a range; a plain click toggles.
// hidden until hover/focus unless already selecting.
export function SelectionCheckbox({
  uuid,
  checked,
  isSelecting,
  onToggle,
  onSelectRange,
  className,
  showCheckbox = true,
}: {
  uuid: string
  checked: boolean
  isSelecting: boolean
  onToggle: (uuid: string) => void
  onSelectRange?: (uuid: string) => void
  className?: string
  showCheckbox?: boolean
}) {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (e.shiftKey && onSelectRange) {
      window.getSelection()?.empty()
      onSelectRange(uuid)
      return
    }

    onToggle(uuid)
  }

  return (
    <div
      className={cn(
        "transition-opacity",
        !checked &&
          !isSelecting &&
          "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
        className,
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="Select book"
    >
      <Checkbox
        onClick={(e) => {
          e.stopPropagation()
        }}
        checked={checked}
        tabIndex={-1}
        className={cn(
          "hover:border-primary bg-background size-5 cursor-pointer rounded-full border-2 shadow-sm transition-colors data-checked:border-2",
          !showCheckbox && "[&_svg]:hidden",
        )}
      />
    </div>
  )
}

// non-interactive twin of SelectionCheckbox for use inside buttons and menu
// items (nesting a real checkbox there would be a button-in-button)
export function SelectionBullet({
  selected,
  indeterminate = false,
  className,
}: {
  selected: boolean
  indeterminate?: boolean
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "border-input hover:border-primary bg-background flex size-5 shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition-colors",
        (selected || indeterminate) &&
          "bg-primary border-primary text-primary-foreground",
        className,
      )}
    >
      {selected ? (
        <icon.Check className="size-3.5" />
      ) : indeterminate ? (
        <icon.Minus className="size-3.5" />
      ) : null}
    </div>
  )
}
