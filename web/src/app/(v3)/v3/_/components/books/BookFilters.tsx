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

import { ShelfFilterEditor } from "@/app/(v3)/v3/_/components/shelves/ShelfFilterEditor"
import { FieldIcon } from "@/app/(v3)/v3/_/components/ui/icon"
import {
  type FieldGroupKey,
  QUICK_FILTER_FIELDS,
  type QuickFilterField,
  getFieldDef,
} from "@/fields"
import * as icon from "@/icons"
import { type ShelfFilterNode } from "@/shelves"
import { type DisplayField, type SortField } from "@/sort"

import { DisplayControl } from "./DisplayControl"
import { FilterControl, FilterEditor } from "./RelationshipDropdownMenu"
import { SaveAsShelfDialog } from "./SaveAsShelfDialog"
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

  // the advanced (shelf-tree) editor + save-as-shelf. on by default so every
  // book list gets them; opt out for contexts where saving makes no sense.
  enableAdvanced?: boolean

  children?: ReactNode
}

const searchHotKey = "/" as const
const filterHotKey = "F" as const
const advancedHotKey = "Shift+F" as const
const saveAsShelfHotKey = "Alt+Shift+S" as const

function countConditions(node: ShelfFilterNode): number {
  if (node.type === "condition") return 1
  if (node.type === "not") return countConditions(node.child)
  return node.children.reduce((n, child) => n + countConditions(child), 0)
}

export function BookFilters({
  controller,
  seedLabel,
  className,
  sortOptions,
  onSortChange,
  displayOverrides,
  onDisplayOverridesChange,
  currentFields,
  enableAdvanced = true,
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
    userFilter,
    setUserFilter,
    effectiveFilter,
  } = controller

  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false)
  // undefined = follow the filter shape (auto-open when the url filter is
  // already advanced); true/false = the user's explicit choice.
  const [advancedOverride, setAdvancedOverride] = useState<boolean | undefined>(
    undefined,
  )
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const advancedVisible = enableAdvanced && (advancedOverride ?? isAdvanced)
  const canSaveAsShelf = enableAdvanced && !!effectiveFilter

  const toggleAdvanced = () => {
    setAdvancedOverride((prev) => !(prev ?? isAdvanced))
  }

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
        if (enableAdvanced) toggleAdvanced()
      },
    },
    {
      hotkey: saveAsShelfHotKey,
      callback: () => {
        if (canSaveAsShelf) setSaveDialogOpen(true)
      },
    },
  ])

  const shownFields = activeFields

  // an advanced tree can't render as quick chips; when collapsed it gets a
  // single summary chip so the active filter is never invisible.
  const advancedChip = isAdvanced && !advancedVisible
  const advancedCount = useMemo(
    () => (isAdvanced ? countConditions(userFilter) : 0),
    [isAdvanced, userFilter],
  )

  const hasChips = !!seedLabel || shownFields.length > 0 || advancedChip

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
            onToggleAdvanced={enableAdvanced ? toggleAdvanced : undefined}
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
        />

        {canSaveAsShelf && (
          <TooltipButton
            variant="outline"
            size="sm"
            className="ml-auto h-7 shrink-0 gap-1.5 rounded-full text-xs font-medium"
            tooltip={t("filters.saveAsShelf")}
            aria-label={t.plain("filters.saveAsShelf")}
            shortcut={[saveAsShelfHotKey]}
            onClick={() => {
              setSaveDialogOpen(true)
            }}
          >
            <icon.BookmarkPlus className="size-3.5" />
            {t("filters.saveAsShelf")}
          </TooltipButton>
        )}
      </div>

      {hasChips && (
        <div className="scroll-x flex items-center gap-1.5">
          {seedLabel && (
            <span className="border-border bg-muted text-muted-foreground inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
              {seedLabel}
            </span>
          )}

          {advancedChip && (
            <button
              className="border-primary/30 bg-primary/10 text-primary inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
              onClick={() => {
                setAdvancedOverride(true)
              }}
            >
              <icon.AdjustmentsHorizontal className="h-3 w-3" />
              {t.plain("filters.advancedSummary", { count: advancedCount })}
            </button>
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

      {advancedVisible && (
        <div className="border-border border-t pt-2">
          <div className="flex items-center justify-between pb-1">
            <span className="text-muted-foreground text-xs font-medium">
              {t("filters.advanced")}
            </span>
            <TooltipButton
              variant="ghost"
              size="icon-sm"
              tooltip={t("filters.closeAdvanced")}
              aria-label={t.plain("filters.closeAdvanced")}
              shortcut={[advancedHotKey]}
              onClick={() => {
                setAdvancedOverride(false)
              }}
            >
              <icon.ChevronUp className="size-4" />
            </TooltipButton>
          </div>
          <ShelfFilterEditor filter={userFilter} onChange={setUserFilter} />
        </div>
      )}

      {effectiveFilter && (
        <SaveAsShelfDialog
          open={saveDialogOpen}
          onOpenChange={setSaveDialogOpen}
          filter={effectiveFilter}
          sortField={sort.field}
          sortDirection={sort.direction}
        />
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  conditionsForField: BookFiltersController["conditionsForField"]
  setConditionsForField: BookFiltersController["setConditionsForField"]
  advancedVisible: boolean
  onToggleAdvanced?: () => void
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
                <FilterableMenuSubContent searchable>
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

        {onToggleAdvanced && (
          <>
            <FilterableMenuSeparator />

            <FilterableMenuItem
              textValue={t.plain("filters.advanced")}
              icon={<icon.AdjustmentsHorizontal className="size-4" />}
              onSelect={() => {
                onToggleAdvanced()
              }}
            >
              {t("filters.advanced")}
              {advancedVisible && <icon.Check className="ml-auto" />}
            </FilterableMenuItem>
          </>
        )}
      </FilterableMenuContent>
    </FilterableMenu>
  )
}
