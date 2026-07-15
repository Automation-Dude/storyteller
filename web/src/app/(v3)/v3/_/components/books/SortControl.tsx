import { useHotkeys } from "@tanstack/react-hotkeys"
import { useMemo } from "react"

import {
  FilterableMenu,
  FilterableMenuContent,
  FilterableMenuItem,
  FilterableMenuSub,
  FilterableMenuSubContent,
  FilterableMenuSubTrigger,
  FilterableMenuTrigger,
} from "@/app/(v3)/v3/_/components/ui/filterable-menu"
import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import {
  useCommon,
  useTranslation,
} from "@/app/(v3)/v3/_/hooks/use-translation"
import { type FieldGroupKey, getFieldDef } from "@/fields"
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
  const c = useCommon()

  const label = options.find((o) => o.value === field)?.label ?? field

  const grouped = useMemo(() => {
    return options.reduce(
      (acc, option) => {
        const fieldDef = getFieldDef(option.value)
        if (!fieldDef) {
          return acc
        }

        const group = fieldDef.group
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!acc[group]) {
          acc[group] = []
        }
        acc[group].push({ ...option, defaultSort: fieldDef.defaultSort })
        return acc
      },
      {} as Record<
        FieldGroupKey,
        { value: SortField; label: string; defaultSort?: "asc" | "desc" }[]
      >,
    )
  }, [options])

  return (
    <div className="flex items-center">
      <FilterableMenu open={open} onOpenChange={onOpenChange}>
        <FilterableMenuTrigger
          render={
            <TooltipButton
              className="items-center rounded-l-lg rounded-r-none border-r-0 pr-1 pl-2 text-xs font-normal"
              variant="ghost"
              tooltip={label}
              aria-label={label}
              shortcut={[sortHotKey]}
            >
              <span className="flex items-center gap-1.5">
                <FieldIcon field={field} className="h-3.5 w-3.5" />
                <span className="sr-only">{label}</span>
              </span>
            </TooltipButton>
          }
        />
        <FilterableMenuContent searchPlaceholder={t.plain("sortBy.searchHint")}>
          {Object.entries(grouped).flatMap(([group, options]) =>
            group !== "alignment" ? (
              options.map((option) => (
                <FilterableMenuItem
                  key={option.value}
                  icon={<FieldIcon field={option.value} className="size-4" />}
                  textValue={option.label}
                  closeOnClick={false}
                  onSelect={() => {
                    if (option.value === field) {
                      flip()
                    } else {
                      onChange(option.value, option.defaultSort ?? "desc")
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
              ))
            ) : (
              <FilterableMenuSub key={group}>
                <FilterableMenuSubTrigger
                  icon={<icon.AlignLeft className="size-4" />}
                  textValue={c(`fields.label.${group}`)}
                >
                  {c(`fields.label.${group}`)}
                </FilterableMenuSubTrigger>
                <FilterableMenuSubContent searchable>
                  {options.map((option) => (
                    <FilterableMenuItem
                      key={option.value}
                      icon={
                        <FieldIcon field={option.value} className="size-4" />
                      }
                      textValue={option.label}
                      onSelect={() => {
                        if (option.value === field) {
                          flip()
                        } else {
                          onChange(option.value, option.defaultSort ?? "desc")
                        }
                      }}
                      closeOnClick={false}
                    >
                      {option.label}

                      {option.value === field && (
                        <span className="text-muted-foreground text-xs">
                          {direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </FilterableMenuItem>
                  ))}
                </FilterableMenuSubContent>
              </FilterableMenuSub>
            ),
          )}
        </FilterableMenuContent>
      </FilterableMenu>
      <TooltipButton
        variant="ghost"
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
