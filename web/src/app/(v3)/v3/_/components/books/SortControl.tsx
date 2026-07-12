import { useHotkeys } from "@tanstack/react-hotkeys"

import {
  FilterableMenu,
  FilterableMenuItem,
} from "@/app/(v3)/v3/_/components/ui/filterable-menu"
import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import { useTranslation } from "@/app/(v3)/v3/_/hooks/use-translation"
import * as icon from "@/icons"
import { FieldIcon } from "@/icons"

import { type SortField } from "./BookFilters"

const toggleSortHotKey = "S"
const sortHotKey = "Shift+S"

export function SortControl({
  options,
  field,
  direction,
  onChange,
  onOpenChange,
  open,
}: {
  options: { value: SortField; label: string }[]
  field: SortField
  direction: "asc" | "desc"
  onChange: (field: SortField, direction: "asc" | "desc") => void
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const flip = () => {
    onChange(field, direction === "asc" ? "desc" : "asc")
  }
  useHotkeys([
    {
      hotkey: toggleSortHotKey,
      callback: () => {
        flip()
      },
    },
    {
      hotkey: sortHotKey,
      callback: () => {
        onOpenChange(!open)
      },
    },
  ])
  const t = useTranslation("BooksPage")

  return (
    <div className="flex items-center">
      <FilterableMenu
        open={open}
        onOpenChange={onOpenChange}
        trigger={
          <TooltipButton
            className="items-center rounded-l-lg rounded-r-none border-r-0 pr-1 pl-2 text-xs font-normal"
            variant="outline"
            tooltip={t("sortBy.tooltip")}
            size="icon"
            aria-label={t.plain("sortBy.tooltip")}
            shortcut={[sortHotKey]}
          >
            <span className="flex items-center gap-1.5">
              <FieldIcon field={field} className="h-3.5 w-3.5" />
              <span className="sr-only">
                {options.find((o) => o.value === field)?.label ?? field}
              </span>
            </span>
          </TooltipButton>
        }
        searchable
        searchPlaceholder={t.plain("sortBy.searchHint")}
      >
        {options.map((option) => (
          <FilterableMenuItem
            key={option.value}
            icon={<FieldIcon field={option.value} className="size-4" />}
            textValue={option.label}
            onSelect={() => {
              if (option.value === field) {
                flip()
              } else {
                onChange(option.value, "desc")
              }
            }}
          >
            {option.label}
            {option.value === field && (
              <span className="text-muted-foreground text-xs">
                {direction === "asc" ? "↑" : "↓"}
              </span>
            )}
          </FilterableMenuItem>
        ))}
      </FilterableMenu>
      <TooltipButton
        variant="outline"
        size="icon"
        className="items-center rounded-l-none rounded-r-lg pr-2 pl-1 text-xs font-normal"
        tooltip={t("toggleSort.tooltip")}
        aria-label={t.plain("toggleSort.tooltip")}
        shortcut={[toggleSortHotKey]}
        onClick={flip}
      >
        {direction === "asc" ? (
          <icon.ArrowUp size="sm" />
        ) : (
          <icon.ArrowDown size="sm" />
        )}
      </TooltipButton>
    </div>
  )
}
