import {
  IconAdjustmentsHorizontal,
  IconArrowDown,
  IconArrowUp,
  IconBookmarkPlus,
  IconColumns,
  IconDots,
  IconLayoutGrid,
  IconLayoutList,
  IconPlus,
} from "@tabler/icons-react"
import { useMemo, useRef, useState } from "react"
import * as icon from "@/icons"

import { Button } from "@v3/_/components/ui/button"
import { ButtonGroup } from "@v3/_/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import {
  FilterableMenu,
  FilterableMenuItem,
} from "@v3/_/components/ui/filterable-menu"
import { TooltipButton } from "@v3/_/components/ui/tooltip-button"
import { type BookFiltersController } from "@v3/_/hooks/use-book-filters"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { FieldIcon, IAdd } from "@/app/(v3)/v3/_/components/ui/icon"
import { getFieldDef, quickFilterFields } from "@/shelves"
import { DISPLAY_FIELDS, GENERAL_SORT_FIELDS, type SortField } from "@/sort"
import { type BookView } from "@/store/slices/uiSettingsSlice"

import { FilterControl, FilterEditor } from "./RelationshipDropdownMenu"
import { SearchInput } from "./SearchInput"
import { ViewSelector } from "./ViewSelector"
import {
  useHotkey,
  useHotkeys,
  useHotkeySequences,
} from "@tanstack/react-hotkeys"

export type { SortDirection, SortField } from "@/sort"

type BookFiltersProps = {
  controller: BookFiltersController
  hasSeriesContext?: boolean
  // a non-removable chip for a page-context seed (series / collection / shelf).
  seedLabel?: string
  className?: string
  bookView?: BookView
  onBookViewChange?: (view: BookView) => void
  // the advanced builder lives in the page; this just toggles its visibility.
  advancedOpen?: boolean
  onToggleAdvanced?: () => void
  onSaveAsShelf?: () => void
}

export function BookFilters({
  controller,
  hasSeriesContext = false,
  seedLabel,
  className,
  bookView,
  onBookViewChange,
  advancedOpen = false,
  onToggleAdvanced,
  onSaveAsShelf,
}: BookFiltersProps) {
  const t = useTranslation("BooksPage")
  const tLabel = useTranslation("Common.fields.label")

  const {
    search,
    setSearch,
    sort,
    setSort,
    displayOverrides,
    setDisplayOverrides,
    isAdvanced,
    activeFields,
    conditionsForField,
    setConditionsForField,
    removeField,
  } = controller

  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)

  useHotkeys([
    {
      hotkey: "F",
      callback: () => {
        searchRef.current?.focus()
      },
    },
    {
      hotkey: "Shift+F",
      callback: () => {
        setFilterMenuOpen((prev) => !prev)
      },
    },
    {
      hotkey: "Shift+S",
      callback: () => {
        setSortMenuOpen((prev) => !prev)
      },
    },
    {
      hotkey: "Shift+V",
      callback: () => {
        setViewMenuOpen((prev) => !prev)
      },
    },
    {
      hotkey: "Mod+Shift+F",
      callback: () => {
        onToggleAdvanced?.()
      },
    },
    {
      hotkey: "Alt+Shift+S",
      callback: () => {
        onSaveAsShelf?.()
      },
    },
  ])

  // fields whose chips are visible: those with active conditions. picking a
  // field from the fan-out menu writes a condition directly, so a chip appears
  // on its own - no separate "pending" state needed.
  const shownFields = activeFields

  const addableFields = useMemo(() => quickFilterFields(), [])

  const sortFieldOptions = useMemo<
    { value: SortField; label: string }[]
  >(() => {
    const fields: SortField[] = hasSeriesContext
      ? ["seriesPosition", ...GENERAL_SORT_FIELDS]
      : [...GENERAL_SORT_FIELDS]
    return fields.map((value) => ({ value, label: tLabel(value) }))
  }, [hasSeriesContext, tLabel])

  const advancedVisible = advancedOpen || isAdvanced

  return (
    <div
      className={cn(
        "bg-background @container/filters sticky top-0 z-30 flex flex-col gap-2 border-b px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <SearchInput
          placeholder={t("seachBooksPlaceholder")}
          ref={searchRef}
          value={search}
          onChange={setSearch}
          shortcut={["F"]}
        />

        {/* wide container: sort, card display and view sit inline. they share
            shrink-0, so once the bar narrows they would be pushed off behind the
            sidebar - below the threshold they fold into the single menu below */}
        <div className="hidden items-center gap-2 @[34rem]/filters:flex">
          <SortControl
            options={sortFieldOptions}
            field={sort.field}
            direction={sort.direction}
            onChange={setSort}
            onOpenChange={setSortMenuOpen}
            open={sortMenuOpen}
          />

          <DropdownMenu open={viewMenuOpen} onOpenChange={setViewMenuOpen}>
            <DropdownMenuTrigger
              render={
                <TooltipButton
                  variant="ghost"
                  size="icon"
                  aria-label="View options"
                  className="shrink-0"
                  tooltip="View options"
                >
                  <IconColumns className="h-4 w-4" />
                </TooltipButton>
              }
            />
            <DropdownMenuContent className="w-44" align="end">
              <DropdownMenuItem disabled className="text-xs font-medium">
                Show on card
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem
                checked={!displayOverrides}
                onClick={() => {
                  void setDisplayOverrides(null)
                }}
              >
                Auto
              </DropdownMenuCheckboxItem>
              {DISPLAY_FIELDS.map((field) => (
                <DropdownMenuCheckboxItem
                  key={field}
                  checked={displayOverrides?.includes(field) ?? false}
                  onClick={() => {
                    void setDisplayOverrides([field])
                  }}
                >
                  <FieldIcon field={field} className="mr-2 h-4 w-4" />
                  {tLabel(field)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {bookView && onBookViewChange && (
            <ViewSelector value={bookView} onChange={onBookViewChange} />
          )}
        </div>

        {/* narrow container: one consolidated menu so nothing gets eclipsed */}
        <div className="flex @[34rem]/filters:hidden">
          <CollapsedOptionsMenu
            sortOptions={sortFieldOptions}
            sortField={sort.field}
            sortDirection={sort.direction}
            onSortChange={setSort}
            displayOverrides={displayOverrides}
            onDisplayOverridesChange={setDisplayOverrides}
            bookView={bookView}
            onBookViewChange={onBookViewChange}
          />
        </div>
      </div>

      {/* chip row: seed (locked) + active filters + add filter; actions pinned right */}
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
                shortcut={["F"]}
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
              shortcut={["Shift+F"]}
            >
              <IconAdjustmentsHorizontal className="h-4 w-4" />
            </TooltipButton>
          )}
          {onSaveAsShelf && (
            <TooltipButton
              variant="ghost"
              aria-label="Save as shelf"
              tooltip="Save as shelf"
              onClick={onSaveAsShelf}
              shortcut={["Alt+Shift+S"]}
            >
              <IconBookmarkPlus className="h-4 w-4" />
            </TooltipButton>
          )}
        </div>
      </div>
    </div>
  )
}

// the narrow-container fallback for the top control row: sort, card display and
// view folded into a single dropdown so they never spill behind the sidebar
function CollapsedOptionsMenu({
  sortOptions,
  sortField,
  sortDirection,
  onSortChange,
  displayOverrides,
  onDisplayOverridesChange,
  bookView,
  onBookViewChange,
}: {
  sortOptions: { value: SortField; label: string }[]
  sortField: SortField
  sortDirection: "asc" | "desc"
  onSortChange: (field: SortField, direction: "asc" | "desc") => void
  displayOverrides: BookFiltersController["displayOverrides"]
  onDisplayOverridesChange: BookFiltersController["setDisplayOverrides"]
  bookView?: BookView
  onBookViewChange?: (view: BookView) => void
}) {
  const tLabel = useTranslation("Common.fields.label")
  const flip = () => {
    onSortChange(sortField, sortDirection === "asc" ? "desc" : "asc")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <TooltipButton
            variant="outline"
            size="icon"
            className="shrink-0 rounded-full"
            aria-label="Sort and view options"
            tooltip="Sort & view"
          >
            <IconDots className="size-4" />
          </TooltipButton>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        {bookView && onBookViewChange && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              View
            </DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={bookView === "grid"}
              onClick={() => {
                onBookViewChange("grid")
              }}
            >
              <IconLayoutGrid className="mr-2 h-4 w-4" />
              Grid
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={bookView === "list"}
              onClick={() => {
                onBookViewChange("list")
              }}
            >
              <IconLayoutList className="mr-2 h-4 w-4" />
              List
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </DropdownMenuGroup>
        )}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-xs">
            Sort by
          </DropdownMenuLabel>
          {sortOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              className="justify-between gap-4"
              closeOnClick={false}
              onClick={() => {
                if (option.value === sortField) {
                  flip()
                } else {
                  onSortChange(option.value, "desc")
                }
              }}
            >
              <span className="flex items-center gap-2">
                <FieldIcon field={option.value} className="h-4 w-4" />
                {option.label}
              </span>
              {option.value === sortField &&
                (sortDirection === "asc" ? (
                  <IconArrowUp className="h-3 w-3" />
                ) : (
                  <IconArrowDown className="h-3 w-3" />
                ))}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-xs">
            Show on card
          </DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={!displayOverrides}
            onClick={() => {
              void onDisplayOverridesChange(null)
            }}
          >
            Auto
          </DropdownMenuCheckboxItem>
          {DISPLAY_FIELDS.map((field) => (
            <DropdownMenuCheckboxItem
              key={field}
              checked={displayOverrides?.includes(field) ?? false}
              onClick={() => {
                void onDisplayOverridesChange([field])
              }}
            >
              <FieldIcon field={field} className="mr-2 h-4 w-4" />
              {tLabel(field)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SortControl({
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
  useHotkey("S", () => {
    flip()
  })

  return (
    <div className="flex items-center">
      <FilterableMenu
        open={open}
        onOpenChange={onOpenChange}
        trigger={
          <TooltipButton
            className="items-center rounded-l-lg rounded-r-none border-r-0 pr-1 pl-2 text-xs font-normal"
            variant="outline"
            tooltip="Sort by"
            size="icon"
            aria-label="Sort by"
            shortcut={["Shift+S"]}
          >
            <span className="flex items-center gap-1.5">
              <FieldIcon field={field} className="h-3.5 w-3.5" />
              <span className="sr-only">
                {options.find((o) => o.value === field)?.label ?? field}
              </span>
            </span>
          </TooltipButton>
        }
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
          </FilterableMenuItem>
        ))}
      </FilterableMenu>
      <TooltipButton
        variant="outline"
        size="icon"
        className="items-center rounded-l-none rounded-r-lg pr-2 pl-1 text-xs font-normal"
        tooltip="Toggle"
        aria-label="Toggle sort direction"
        shortcut={["S"]}
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
