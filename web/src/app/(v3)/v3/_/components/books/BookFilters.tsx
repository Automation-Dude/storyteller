import { useHotkeys } from "@tanstack/react-hotkeys"
import { type ReactNode, useMemo, useRef, useState } from "react"

import {
  FilterableMenu,
  FilterableMenuItem,
  FilterableMenuSeparator,
} from "@v3/_/components/ui/filterable-menu"
import { TooltipButton } from "@v3/_/components/ui/tooltip-button"
import { type BookFiltersController } from "@v3/_/hooks/use-book-filters"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { FieldIcon } from "@/app/(v3)/v3/_/components/ui/icon"
import * as icon from "@/icons"
import { getFieldDef, quickFilterFields } from "@/shelves"
import { type SortField } from "@/sort"

import { DisplayControl } from "./DisplayControl"
import { FilterControl, FilterEditor } from "./RelationshipDropdownMenu"
import { SearchInput } from "./SearchInput"
import { SortControl } from "./SortControl"

export type { SortDirection, SortField } from "@/sort"

type BookFiltersProps = {
  controller: BookFiltersController
  seedLabel?: string
  className?: string

  sortOptions: { value: SortField; label: string }[]
  onSortChange: (field: SortField, direction: "asc" | "desc") => void

  bookView?: import("@/store/slices/uiSettingsSlice").BookView
  onBookViewChange?: (
    view: import("@/store/slices/uiSettingsSlice").BookView,
  ) => void

  advancedOpen?: boolean
  onToggleAdvanced?: () => void
  onSaveAsShelf?: () => void

  children?: ReactNode
}

const searchHotKey = "/" as const
const filterHotKey = "F" as const
const advancedHotKey = "Shift+F" as const
const saveAsShelfHotKey = "Alt+Shift+S" as const

export function BookFilters({
  controller,
  seedLabel,
  className,
  sortOptions,
  onSortChange,
  bookView,
  onBookViewChange,
  advancedOpen = false,
  onToggleAdvanced,
  onSaveAsShelf,
  children,
}: BookFiltersProps) {
  const t = useTranslation("BooksPage")

  const {
    search,
    setSearch,
    sort,
    isAdvanced,
    activeFields,
    conditionsForField,
    setConditionsForField,
    removeField,
    displayOverrides,
    setDisplayOverrides,
  } = controller

  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false)
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

  const hasChips = !!seedLabel || shownFields.length > 0

  return (
    <div
      className={cn(
        "bg-surface-base sticky top-0 z-30 flex flex-col gap-2 px-4 pb-3",
        className,
      )}
    >
      <div className="flex h-8 items-center gap-1.5">
        <SearchInput
          placeholder={t("seachBooksPlaceholder")}
          ref={searchRef}
          value={search}
          onChange={setSearch}
          shortcut={[searchHotKey]}
          className="h-8"
        />

        {!isAdvanced && (
          <FilterMenu
            open={filterMenuOpen}
            onOpenChange={setFilterMenuOpen}
            addableFields={addableFields}
            conditionsForField={conditionsForField}
            setConditionsForField={setConditionsForField}
            advancedVisible={advancedVisible}
            onToggleAdvanced={onToggleAdvanced}
            onSaveAsShelf={onSaveAsShelf}
          />
        )}

        <SortControl
          options={sortOptions}
          field={sort.field}
          direction={sort.direction}
          onChange={onSortChange}
          onOpenChange={setSortMenuOpen}
          open={sortMenuOpen}
        />

        <DisplayControl
          displayOverrides={displayOverrides}
          onDisplayOverridesChange={setDisplayOverrides}
          open={displayMenuOpen}
          onOpenChange={setDisplayMenuOpen}
          bookView={bookView}
          onBookViewChange={onBookViewChange}
        />
      </div>

      {hasChips && (
        <div className="scroll-x flex items-center gap-1.5">
          {seedLabel && (
            <span className="border-border bg-muted text-muted-foreground inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
              {seedLabel}
            </span>
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
        </div>
      )}

      {children}
    </div>
  )
}

function FilterMenu({
  open,
  onOpenChange,
  addableFields,
  conditionsForField,
  setConditionsForField,
  advancedVisible,
  onToggleAdvanced,
  onSaveAsShelf,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  addableFields: ReturnType<typeof quickFilterFields>
  conditionsForField: BookFiltersController["conditionsForField"]
  setConditionsForField: BookFiltersController["setConditionsForField"]
  advancedVisible: boolean
  onToggleAdvanced?: () => void
  onSaveAsShelf?: () => void
}) {
  const t = useTranslation("BooksPage")
  const tLabel = useTranslation("Common.fields.label")

  return (
    <FilterableMenu
      open={open}
      onOpenChange={onOpenChange}
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

      {(onToggleAdvanced || onSaveAsShelf) && (
        <>
          <FilterableMenuSeparator />

          {onToggleAdvanced && (
            <FilterableMenuItem
              textValue="Advanced filter"
              icon={<icon.AdjustmentsHorizontal className="size-4" />}
              onSelect={() => {
                onToggleAdvanced()
              }}
            >
              Advanced filter
              {advancedVisible && <icon.Check className="ml-auto" />}
            </FilterableMenuItem>
          )}

          {onSaveAsShelf && (
            <FilterableMenuItem
              textValue="Save as shelf"
              icon={<icon.BookmarkPlus className="size-4" />}
              onSelect={() => {
                onSaveAsShelf()
              }}
            >
              Save as shelf
            </FilterableMenuItem>
          )}
        </>
      )}
    </FilterableMenu>
  )
}
