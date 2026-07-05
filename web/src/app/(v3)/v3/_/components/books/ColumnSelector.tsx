
import { useTranslation } from "@v3/_/hooks/use-translation"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/app/(v3)/v3/_/components/ui/dropdown-menu"
import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import { cn } from "@/cn"
import * as icon from "@/icons"
import { type DisplayField, GENERAL_SORT_FIELDS } from "@/sort"

// all general sort fields plus authors are pickable as list columns
const PICKABLE_FIELDS: DisplayField[] = [
  "authors",
  ...GENERAL_SORT_FIELDS.filter((f) => f !== "title"),
]

type ColumnSelectorProps = {
  visibleFields: DisplayField[]
  onChange: (fields: DisplayField[]) => void
  className?: string
}

export function ColumnSelector({
  visibleFields,
  onChange,
  className,
}: ColumnSelectorProps) {
  const t = useTranslation("Common.fields")

  const toggle = (field: DisplayField) => {
    if (visibleFields.includes(field)) {
      onChange(visibleFields.filter((f) => f !== field))
    } else {
      onChange([...visibleFields, field])
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <TooltipButton
            variant="ghost"
            className={cn("shrink-0 gap-1.5 text-xs font-normal", className)}
            tooltip="Show/hide columns"
            aria-label="Fields"
          >
            <icon.Columns3 className="h-3.5 w-3.5" />
          </TooltipButton>
        }
      />

      <DropdownMenuContent
        className="pointer-events-auto z-100 w-48 min-w-44"
        align="end"
      >
        {PICKABLE_FIELDS.map((field) => (
          <DropdownMenuCheckboxItem
            key={field}
            checked={visibleFields.includes(field)}
            onCheckedChange={() => {
              toggle(field)
            }}
          >
            {t(`label.${field}`)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
