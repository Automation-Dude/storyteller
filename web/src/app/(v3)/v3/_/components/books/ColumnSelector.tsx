import { IconColumns3 } from "@tabler/icons-react"

import { DISPLAY_FIELD_LABELS, GENERAL_SORT_FIELDS, type DisplayField } from "@/sort"

import { Button } from "@v3/_/components/ui/button"
import { Checkbox } from "@v3/_/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@v3/_/components/ui/popover"

// all general sort fields plus authors are pickable as list columns
const PICKABLE_FIELDS: DisplayField[] = [
  "authors",
  ...GENERAL_SORT_FIELDS.filter((f) => f !== "title"),
]

type ColumnSelectorProps = {
  visibleFields: DisplayField[]
  onChange: (fields: DisplayField[]) => void
}

export function ColumnSelector({
  visibleFields,
  onChange,
}: ColumnSelectorProps) {
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
          <Button
            variant="outline"
            size="default"
            className="shrink-0 gap-1.5 text-xs font-normal"
          >
            <IconColumns3 className="h-3.5 w-3.5" />
            Fields
          </Button>
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
              {DISPLAY_FIELD_LABELS[field]}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
