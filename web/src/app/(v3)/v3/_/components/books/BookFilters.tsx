import { useHotkeys } from "@tanstack/react-hotkeys"
import { type ReactNode, useMemo, useRef, useState } from "react"

import {
  FilterableMenu,
  FilterableMenuContent,
  FilterableMenuItem,
  FilterableMenuSeparator,
  FilterableMenuSub,
  FilterableMenuSubContent,
  FilterableMenuSubTrigger,
  FilterableMenuTrigger,
} from "@v3/_/components/ui/filterable-menu"
import { TooltipButton } from "@v3/_/components/ui/tooltip-button"
import { type BookFiltersController } from "@v3/_/hooks/use-book-filters"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { FieldIcon } from "@/app/(v3)/v3/_/components/ui/icon"
import * as icon from "@/icons"
import {
  FieldGroupKey,
  getFieldDef,
  QUICK_FILTER_FIELDS,
  QuickFilterField,
} from "@/fields"
import { type DisplayField, type SortField } from "@/sort"

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

  // display fields shown below covers. overrides null = auto; currentFields is
  // the resolved set (auto or manual) so the menu can seed a toggle from it.
  displayOverrides: DisplayField[] | null
  onDisplayOverridesChange: (fields: DisplayField[] | null) => void
  currentFields: DisplayField[]

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
  displayOverrides,
  onDisplayOverridesChange,
  currentFields,
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
          onDisplayOverridesChange={onDisplayOverridesChange}
          currentFields={currentFields}
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
  conditionsForField,
  setConditionsForField,
  advancedVisible,
  onToggleAdvanced,
  onSaveAsShelf,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  conditionsForField: BookFiltersController["conditionsForField"]
  setConditionsForField: BookFiltersController["setConditionsForField"]
  advancedVisible: boolean
  onToggleAdvanced?: () => void
  onSaveAsShelf?: () => void
}) {
  const t = useTranslation("BooksPage")
  const tLabel = useTranslation("Common.fields.label")

  const groups = useMemo(() => {
    return QUICK_FILTER_FIELDS.reduce(
      (acc, field) => {
        const group = getFieldDef(field).group
        if (!acc[group]) {
          acc[group] = []
        }
        acc[group].push(field)
        return acc
      },
      {} as Record<FieldGroupKey, QuickFilterField[]>,
    )
  }, [])

  return (
    <FilterableMenu open={open} onOpenChange={onOpenChange}>
      <FilterableMenuTrigger
        render={
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
      />
      <FilterableMenuContent searchPlaceholder={t.plain("filters.filters")}>
        {Object.entries(groups).flatMap(([group, fields]) =>
          group !== "alignment" ? (
            fields.map((field) => (
              <FilterableMenuSub key={field}>
                <FilterableMenuSubTrigger
                  icon={<FieldIcon field={field} className="size-4" />}
                  textValue={tLabel.plain(getFieldDef(field).labelKey as never)}
                >
                  {tLabel(getFieldDef(field).labelKey as never)}
                </FilterableMenuSubTrigger>
                <FilterableMenuSubContent>
                  <FilterEditor
                    field={field}
                    def={getFieldDef(field)}
                    conditions={conditionsForField(field)}
                    onChange={(next) => {
                      setConditionsForField(field, next)
                    }}
                    enabled
                  />
                </FilterableMenuSubContent>
              </FilterableMenuSub>
            ))
          ) : (
            <FilterableMenuSub key={group}>
              <FilterableMenuSubTrigger
                icon={<icon.AlignLeft className="size-4" />}
                textValue={tLabel.plain(group)}
              >
                {tLabel.plain(group)}
              </FilterableMenuSubTrigger>
              <FilterableMenuSubContent searchable>
                {fields.map((field) => (
                  <FilterableMenuSub key={field}>
                    <FilterableMenuSubTrigger
                      icon={<FieldIcon field={field} className="size-4" />}
                      textValue={tLabel.plain(
                        getFieldDef(field).labelKey as never,
                      )}
                    >
                      {tLabel(getFieldDef(field).labelKey as never)}
                    </FilterableMenuSubTrigger>
                    <FilterableMenuSubContent>
                      <FilterEditor
                        enabled
                        field={field}
                        def={getFieldDef(field)}
                        conditions={conditionsForField(field)}
                        onChange={(next) => {
                          setConditionsForField(field, next)
                        }}
                      />
                    </FilterableMenuSubContent>
                  </FilterableMenuSub>
                ))}
              </FilterableMenuSubContent>
            </FilterableMenuSub>
          ),
        )}

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
      </FilterableMenuContent>
    </FilterableMenu>
  )
}
