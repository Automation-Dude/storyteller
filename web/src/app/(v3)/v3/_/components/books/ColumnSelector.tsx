import { IconColumns3 } from "@tabler/icons-react"

import { Checkbox } from "@v3/_/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@v3/_/components/ui/popover"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import { cn } from "@/cn"
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
  const t = useTranslation("Fields")

  const toggle = (field: DisplayField) => {
    if (visibleFields.includes(field)) {
      onChange(visibleFields.filter((f) => f !== field))
    } else {
      onChange([...visibleFields, field])
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <TooltipButton
            variant="ghost"
            className={cn("shrink-0 gap-1.5 text-xs font-normal", className)}
            tooltip="Show/hide columns"
            aria-label="Fields"
          >
            <IconColumns3 className="h-3.5 w-3.5" />
          </TooltipButton>
        }
      />

      <PopoverContent className="w-48" align="end">
        <div className="flex flex-col gap-1">
          {PICKABLE_FIELDS.map((field) => (
            <label
              key={field}
              className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <Checkbox
                checked={visibleFields.includes(field)}
                onCheckedChange={() => {
                  toggle(field)
                }}
              />
              {t(`label.${field}`)}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
