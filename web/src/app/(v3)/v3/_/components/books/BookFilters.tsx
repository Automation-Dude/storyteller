import {
  IconAdjustmentsHorizontal,
  IconArrowDown,
  IconArrowUp,
  IconBookmarkPlus,
  IconChevronDown,
  IconColumns,
  IconPlus,
} from "@tabler/icons-react"
import { useMemo, useState } from "react"

import { Button } from "@v3/_/components/ui/button"
import { ButtonGroup } from "@v3/_/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { TooltipButton } from "@v3/_/components/ui/tooltip-button"
import { type BookFiltersController } from "@v3/_/hooks/use-book-filters"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import {
  type ShelfFilterField,
  getFieldDef,
  quickFilterFields,
} from "@/shelves"
import { DISPLAY_FIELDS, GENERAL_SORT_FIELDS, type SortField } from "@/sort"
import { type BookView } from "@/store/slices/uiSettingsSlice"

import { FilterControl, FilterEditor } from "./RelationshipDropdownMenu"
import { SearchInput } from "./SearchInput"
import { ViewSelector } from "./ViewSelector"
import { FieldIcon } from "./field-icons"

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
  const tLabel = useTranslation("Fields.label")

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

  // fields whose chips are visible: those with active conditions. picking a
  // field from the fan-out menu writes a condition directly, so a chip appears
  // on its own - no separate "pending" state needed.
  const shownFields = activeFields

  const addableFields = useMemo(
    () => quickFilterFields().filter((f) => !shownFields.includes(f)),
    [shownFields],
  )

  const sortFieldOptions = useMemo<
    { value: SortField; label: string }[]
  >(() => {
    const fields: SortField[] = hasSeriesContext
      ? ["seriesPosition", ...GENERAL_SORT_FIELDS]
      : [...GENERAL_SORT_FIELDS]
    return fields.map((value) => ({ value, label: tLabel(value) }))
  }, [hasSeriesContext, tLabel])

  // a complex tree (or / not / nesting) can't be shown as chips; force the
  // advanced builder visible so the filter is never hidden from the user.
  const advancedVisible = advancedOpen || isAdvanced

  return (
    <div
      className={cn(
        "bg-background sticky top-0 z-30 flex flex-col gap-2 border-b px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <SearchInput
          placeholder={t("seachBooksPlaceholder")}
          value={search}
          onChange={setSearch}
        />

        <SortControl
          options={sortFieldOptions}
          field={sort.field}
          direction={sort.direction}
          onChange={setSort}
        />

        {/* quiet view options: card secondary line override */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="View options"
                className="shrink-0"
              >
                <IconColumns className="h-4 w-4" />
              </Button>
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

      {/* chip row: seed (locked) + active filters + add filter; actions pinned right */}
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

        {!isAdvanced && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="text-muted-foreground hover:text-foreground inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium">
                  <IconPlus className="h-3 w-3" />
                  {t("filters.filters")}
                </button>
              }
            />
            <DropdownMenuContent className="max-h-80 w-52 overflow-y-auto">
              {addableFields.map((field) => (
                <AddFilterSubmenu
                  key={field}
                  field={field}
                  controller={controller}
                  label={tLabel(getFieldDef(field).labelKey as never)}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {onToggleAdvanced && (
            <TooltipButton
              variant={advancedVisible ? "secondary" : "ghost"}
              aria-label="Toggle advanced filter"
              tooltip="Advanced filter"
              onClick={onToggleAdvanced}
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
            >
              <IconBookmarkPlus className="h-4 w-4" />
            </TooltipButton>
          )}
        </div>
      </div>
    </div>
  )
}

// one entry in the fan-out "Add filter" menu: hovering opens a submenu with the
// field's value editor inline, so a tag (or range, or date) can be picked in a
// single hover without first materializing an empty chip. the editor only
// fetches its options once the submenu opens.
function AddFilterSubmenu({
  field,
  controller,
  label,
}: {
  field: ShelfFilterField
  controller: BookFiltersController
  label: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <DropdownMenuSub open={open} onOpenChange={setOpen}>
      <DropdownMenuSubTrigger>
        <FieldIcon field={field} className="mr-2 h-4 w-4" />
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-72 p-0">
        {/* the editor is not a menu item: keep keystrokes (so the search input
            works, not menu typeahead) and clicks (so toggling several values
            doesn't close the menu) from bubbling to the menu. */}
        <div
          onKeyDown={(e) => {
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.stopPropagation()
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
          }}
        >
          <FilterEditor
            field={field}
            def={getFieldDef(field)}
            conditions={controller.conditionsForField(field)}
            onChange={(next) => {
              controller.setConditionsForField(field, next)
            }}
            enabled={open}
          />
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function SortControl({
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
  const [open, setOpen] = useState(false)
  const flip = () => {
    onChange(field, direction === "asc" ? "desc" : "asc")
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <ButtonGroup className="shrink-0 text-sm">
        <DropdownMenuTrigger
          render={
            <Button
              className="min-w-[100px] justify-between text-xs font-normal"
              variant="outline"
            >
              <span className="flex items-center gap-1.5">
                <FieldIcon field={field} className="h-3.5 w-3.5" />
                {options.find((o) => o.value === field)?.label ?? field}
              </span>
              <IconChevronDown className="h-3 w-3" />
            </Button>
          }
        />
        <Button
          variant="outline"
          onClick={flip}
          aria-label="Toggle sort direction"
        >
          {direction === "asc" ? (
            <IconArrowUp className="h-3 w-3" />
          ) : (
            <IconArrowDown className="h-3 w-3" />
          )}
        </Button>
      </ButtonGroup>
      <DropdownMenuContent className="w-fit">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className="justify-between gap-4"
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
                <IconArrowUp className="h-3 w-3" />
              ) : (
                <IconArrowDown className="h-3 w-3" />
              ))}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
