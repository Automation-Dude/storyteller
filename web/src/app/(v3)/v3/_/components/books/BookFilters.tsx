import { useHotkeys } from "@tanstack/react-hotkeys"
import { useMemo, useRef, useState } from "react"

import {
  FilterableMenu,
  FilterableMenuItem,
} from "@v3/_/components/ui/filterable-menu"
import { TooltipButton } from "@v3/_/components/ui/tooltip-button"
import { type BookFiltersController } from "@v3/_/hooks/use-book-filters"
import { useCompactHeader } from "@v3/_/hooks/use-compact-header"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { FieldIcon } from "@/app/(v3)/v3/_/components/ui/icon"
import * as icon from "@/icons"
import { getFieldDef, quickFilterFields } from "@/shelves"

import { FilterControl, FilterEditor } from "./RelationshipDropdownMenu"
import { SearchInput } from "./SearchInput"

export type { SortDirection, SortField } from "@/sort"

type BookFiltersProps = {
  controller: BookFiltersController
  seedLabel?: string
  className?: string
  advancedOpen?: boolean
  onToggleAdvanced?: () => void
  onSaveAsShelf?: () => void
}

const searchHotKey = "/" as const
const filterHotKey = "F" as const
const advancedHotKey = "Shift+F" as const
const saveAsShelfHotKey = "Alt+Shift+S" as const

export function BookFilters({
  controller,
  seedLabel,
  className,
  advancedOpen = false,
  onToggleAdvanced,
  onSaveAsShelf,
}: BookFiltersProps) {
  const { isCompact } = useCompactHeader()
  const t = useTranslation("BooksPage")
  const tLabel = useTranslation("Common.fields.label")

  const {
    search,
    setSearch,
    isAdvanced,
    activeFields,
    conditionsForField,
    setConditionsForField,
    removeField,
  } = controller

  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useHotkeys([
    {
      hotkey: searchHotKey,
      callback: () => {
        searchRef.current?.focus()
      },
    },
    {
      hotkey: filterHotKey,
      callback: () => {
        setFilterMenuOpen((prev) => !prev)
      },
    },
    {
      hotkey: advancedHotKey,
      callback: () => {
        onToggleAdvanced?.()
      },
    },
    {
      hotkey: saveAsShelfHotKey,
      callback: () => {
        onSaveAsShelf?.()
      },
    },
  ])

  const shownFields = activeFields
  const addableFields = useMemo(() => quickFilterFields(), [])
  const advancedVisible = advancedOpen || isAdvanced

  const hasChips = !!seedLabel || shownFields.length > 0 || advancedVisible

  const showSearchBar = !isCompact
  const showBar = showSearchBar || hasChips

  if (!showBar) return null

  return (
    <div
      className={cn(
        "bg-surface-base sticky top-0 z-30 flex flex-col gap-2 border-b px-4 py-3",
        className,
      )}
    >
      {showSearchBar && (
        <SearchInput
          layoutId="book-search-bar"
          placeholder={t("seachBooksPlaceholder")}
          ref={searchRef}
          value={search}
          onChange={setSearch}
          shortcut={[searchHotKey]}
        />
      )}

      {hasChips && (
        <div className="scroll-x flex items-center gap-1.5">
          {seedLabel && (
            <span className="border-border bg-muted text-muted-foreground inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
              {seedLabel}
            </span>
          )}

          {!isAdvanced && (
            <FilterableMenu
              open={filterMenuOpen}
              onOpenChange={setFilterMenuOpen}
              searchable
              searchPlaceholder={t.plain("filters.filters")}
              trigger={
                <TooltipButton
                  variant="outline"
                  className="text-muted-foreground hover:text-foreground inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium"
                  tooltip={t("filters.filters")}
                  shortcut={[filterHotKey]}
                  aria-label={t("filters.filters")}
                >
                  <icon.Filter />
                </TooltipButton>
              }
            >
              {addableFields.map((field) => (
                <FilterableMenuItem
                  key={field}
                  icon={<FieldIcon field={field} className="size-4" />}
                  textValue={tLabel.plain(getFieldDef(field).labelKey as never)}
                  submenu={
                    <FilterEditor
                      field={field}
                      def={getFieldDef(field)}
                      conditions={conditionsForField(field)}
                      onChange={(next) => {
                        setConditionsForField(field, next)
                      }}
                      enabled
                    />
                  }
                >
                  {tLabel(getFieldDef(field).labelKey as never)}
                </FilterableMenuItem>
              ))}
            </FilterableMenu>
          )}

          {!isAdvanced &&
            shownFields.map((field) => (
              <FilterControl
                key={field}
                field={field}
                conditions={conditionsForField(field)}
                onChange={(next) => {
                  setConditionsForField(field, next)
                }}
                onRemove={() => {
                  removeField(field)
                }}
              />
            ))}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {onToggleAdvanced && (
              <TooltipButton
                variant={advancedVisible ? "secondary" : "ghost"}
                aria-label="Toggle advanced filter"
                tooltip="Advanced filter"
                onClick={onToggleAdvanced}
                shortcut={[advancedHotKey]}
              >
                <icon.AdjustmentsHorizontal className="h-4 w-4" />
              </TooltipButton>
            )}

            {onSaveAsShelf && (
              <TooltipButton
                variant="ghost"
                aria-label="Save as shelf"
                tooltip="Save as shelf"
                onClick={onSaveAsShelf}
                shortcut={[saveAsShelfHotKey]}
              >
                <icon.BookmarkPlus className="h-4 w-4" />
              </TooltipButton>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
