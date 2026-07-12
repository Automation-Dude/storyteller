import { useHotkeys } from "@tanstack/react-hotkeys"
import { useMemo, useRef, useState } from "react"

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

import { FieldIcon } from "@/app/(v3)/v3/_/components/ui/icon"
import * as icon from "@/icons"
import { getFieldDef, quickFilterFields } from "@/shelves"
import { DISPLAY_FIELDS, GENERAL_SORT_FIELDS, type SortField } from "@/sort"
import { type BookView } from "@/store/slices/uiSettingsSlice"

import { DisplayControl } from "./DisplayControl"
import { FilterControl, FilterEditor } from "./RelationshipDropdownMenu"
import { SearchInput } from "./SearchInput"
import { SortControl } from "./SortControl"
import { ViewSelector } from "./ViewSelector"

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

const searchHotKey = "/" as const
const filterHotKey = "F" as const
const advancedHotKey = "Shift+F" as const
const saveAsShelfHotKey = "Alt+Shift+S" as const

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
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)

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
        "bg-surface-base @container/filters sticky top-0 z-30 flex flex-col gap-2 border-b px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <SearchInput
          placeholder={t("seachBooksPlaceholder")}
          ref={searchRef}
          value={search}
          onChange={setSearch}
          shortcut={[searchHotKey]}
        />

        <div className="hidden items-center gap-2 @[34rem]/filters:flex">
          <SortControl
            options={sortFieldOptions}
            field={sort.field}
            direction={sort.direction}
            onChange={setSort}
            onOpenChange={setSortMenuOpen}
            open={sortMenuOpen}
          />

          <DisplayControl
            displayOverrides={displayOverrides}
            onDisplayOverridesChange={setDisplayOverrides}
            open={displayMenuOpen}
            onOpenChange={setDisplayMenuOpen}
          />

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
            <icon.Dots className="size-4" />
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
              <icon.LayoutGrid className="mr-2 h-4 w-4" />
              Grid
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={bookView === "list"}
              onClick={() => {
                onBookViewChange("list")
              }}
            >
              <icon.LayoutList className="mr-2 h-4 w-4" />
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
                  <icon.ArrowUp className="h-3 w-3" />
                ) : (
                  <icon.ArrowDown className="h-3 w-3" />
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
