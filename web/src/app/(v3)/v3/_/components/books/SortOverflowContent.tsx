import {
  DropdownMenuItem,
} from "@v3/_/components/ui/dropdown-menu"

import { FieldIcon } from "@/icons"
import * as icon from "@/icons"
import { type SortField } from "@/sort"

export function SortOverflowContent({
  options,
  field,
  direction,
  onChange,
}: {
  options: { value: SortField; label: string }[]
  field: SortField
  direction: "asc" | "desc"
  onChange: (field: SortField, direction: "asc" | "desc") => void
}) {
  const flip = () => {
    onChange(field, direction === "asc" ? "desc" : "asc")
  }

  return (
    <>
      {options.map((option) => (
        <DropdownMenuItem
          key={option.value}
          className="justify-between gap-4"
          closeOnClick={false}
          onClick={() => {
            if (option.value === field) {
              flip()
            } else {
              onChange(option.value, "desc")
            }
          }}
        >
          <span className="flex items-center gap-2">
            <FieldIcon field={option.value} className="h-4 w-4" />
            {option.label}
          </span>

          {option.value === field &&
            (direction === "asc" ? (
              <icon.ArrowUp className="h-3 w-3" />
            ) : (
              <icon.ArrowDown className="h-3 w-3" />
            ))}
        </DropdownMenuItem>
      ))}
    </>
  )
}
