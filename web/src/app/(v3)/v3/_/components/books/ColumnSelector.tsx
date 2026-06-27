import { IconColumns3 } from "@tabler/icons-react"

import { GENERAL_SORT_FIELDS, type DisplayField } from "@/sort"

import { Button } from "@v3/_/components/ui/button"
import { Checkbox } from "@v3/_/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@v3/_/components/ui/popover"
import { useTranslation } from "@v3/_/hooks/use-translation"

// all general sort fields plus authors are pickable as list columns
const PICKABLE_FIELDS: DisplayField[] = [
  "authors",
  ...GENERAL_SORT_FIELDS.filter((f) => f !== "title"),
]

type ColumnSelectorProps = {
  visibleFields: DisplayField[]
  onChange: (fields: DisplayField[]) => void
  compact?: boolean
}

export function ColumnSelector({
  visibleFields,
  onChange,
  compact = false,
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
          compact ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground flex size-6 items-center justify-center rounded-md transition-colors"
            >
              <IconColumns3 className="size-3.5" />
            </button>
          ) : (
            <Button
              variant="outline"
              size="default"
              className="shrink-0 gap-1.5 text-xs font-normal"
            >
              <IconColumns3 className="h-3.5 w-3.5" />
              Fields
            </Button>
          )
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
