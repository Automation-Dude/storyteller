import {
  IconArrowDown,
  IconArrowUp,
  IconBook,
  IconChevronDown,
  IconFilter,
  IconHeadphones,
  IconX,
} from "@tabler/icons-react"
import { useMemo, useState } from "react"

import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import { ButtonGroup } from "@v3/_/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@v3/_/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v3/_/components/ui/select"
import { Separator } from "@v3/_/components/ui/separator"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { IconReadaloud } from "@/components/icons/IconReadaloud"
import {
  DISPLAY_FIELD_LABELS,
  type DisplayField,
  GENERAL_SORT_FIELDS,
  SORT_FIELD_LABELS,
  type SortDirection,
  type SortField,
} from "@/sort"
import {
  type MediaFilter,
  useListCollectionsQuery,
  useListSeriesQuery,
  useListStatusesQuery,
} from "@/store/api"

import { SearchInput } from "./SearchInput"

export type { SortDirection, SortField }

export type BookFiltersState = {
  searchInput: string
  sortField: SortField
  sortDirection: SortDirection
  mediaFilter: MediaFilter
  collectionFilter: string | null
  seriesFilter: string | null
  statusFilter: string | null
}

type BookFiltersProps = {
  state: BookFiltersState
  onChange: <K extends keyof BookFiltersState>(
    key: K,
    value: BookFiltersState[K],
  ) => void
  filterPopoverOpen: boolean
  setFilterPopoverOpen: (open: boolean) => void
  hideCollectionFilter?: boolean
  hideSeriesFilter?: boolean
  showSaveSearch?: boolean
  className?: string
  // when provided, renders a "Show" control that overrides the card secondary
  // line. null override = automatic (derived from the active sort / context).
  displayOverride?: DisplayField | null
  onDisplayOverrideChange?: (value: DisplayField | null) => void
  // whether a series context is active (enables the "Series position" option)
  hasSeriesContext?: boolean
}

// the sentinel for "automatic" in the Show select (Select values are strings)
const DISPLAY_AUTO = "__auto__"

// a compact, curated subset for the Show override (not every sortable field)
const DISPLAY_OVERRIDE_FIELDS: DisplayField[] = [
  "authors",
  "userRating",
  "pageCount",
  "duration",
  "publicationDate",
]

export function BookFilters({
  state,
  onChange,
  filterPopoverOpen,
  setFilterPopoverOpen,
  hideCollectionFilter = false,
  hideSeriesFilter = false,
  className,
  displayOverride,
  onDisplayOverrideChange,
  hasSeriesContext = false,
}: BookFiltersProps) {
  const t = useTranslation("BooksPage")
  const { data: collections } = useListCollectionsQuery()
  const { data: seriesList } = useListSeriesQuery()
  const { data: statuses } = useListStatusesQuery()

  const sortFieldOptions: { value: SortField; label: string }[] = useMemo(() => {
    // series position is only offered (and defaulted to) inside a series context
    const fields: SortField[] = hasSeriesContext
      ? ["seriesPosition", ...GENERAL_SORT_FIELDS]
      : GENERAL_SORT_FIELDS
    return fields.map((value) => ({ value, label: SORT_FIELD_LABELS[value] }))
  }, [hasSeriesContext])

  const mediaFilterOptions: {
    value: MediaFilter
    label: string
    icon?: React.ReactNode
  }[] = [
    { value: "all", label: t("mediaTypes.all") },
    {
      value: "ebook",
      label: t("mediaTypes.ebook"),
      icon: <IconBook className="h-3 w-3" />,
    },
    {
      value: "audiobook",
      label: t("mediaTypes.audiobook"),
      icon: <IconHeadphones className="h-3 w-3" />,
    },
    {
      value: "synced",
      label: t("mediaTypes.readaloud"),
      icon: <IconReadaloud className="h-4 w-4" />,
    },
  ]

  const activeFilterCount = [
    !hideCollectionFilter && state.collectionFilter,
    !hideSeriesFilter && state.seriesFilter,
    state.statusFilter,
  ].filter(Boolean).length

  const clearFilters = () => {
    if (!hideCollectionFilter) onChange("collectionFilter", null)
    if (!hideSeriesFilter) onChange("seriesFilter", null)
    onChange("statusFilter", null)
  }

  const [sortFieldPopoverOpen, setSortFieldPopoverOpen] = useState(false)

  const activeCollection = collections?.find(
    (c) => c.uuid === state.collectionFilter,
  )
  const activeSeries = seriesList?.find((s) => s.uuid === state.seriesFilter)
  const activeStatus = statuses?.find((s) => s.uuid === state.statusFilter)

  return (
    <div
      className={cn(
        "bg-background sticky top-0 z-30 flex flex-col gap-3 border-b px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <SearchInput
          placeholder={t("seachBooksPlaceholder")}
          value={state.searchInput}
          onChange={(value) => {
            onChange("searchInput", value)
          }}
        />

        <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="default"
                className="shrink-0 gap-1.5 text-xs font-normal"
              >
                <IconFilter className="h-3.5 w-3.5" />
                {t("filters.filters")}
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            }
          />
          <PopoverContent className="w-72" align="end">
            <div className="flex flex-col gap-4">
              {!hideCollectionFilter && (
                <div className="flex flex-col gap-2">
                  <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {t("filters.collection")}
                  </label>
                  <Select
                    value={state.collectionFilter ?? "all"}
                    onValueChange={(v) => {
                      onChange("collectionFilter", v === "all" ? null : v)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>{t("filters.allCollections")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("filters.allCollections")}
                      </SelectItem>
                      {collections?.map((c) => (
                        <SelectItem key={c.uuid} value={c.uuid}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!hideSeriesFilter && (
                <div className="flex flex-col gap-2">
                  <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {t("filters.series")}
                  </label>
                  <Select
                    value={state.seriesFilter ?? "all"}
                    onValueChange={(v) => {
                      onChange("seriesFilter", v === "all" ? null : v)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>{t("filters.allSeries")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("filters.allSeries")}
                      </SelectItem>
                      {seriesList?.map((s) => (
                        <SelectItem key={s.uuid} value={s.uuid}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {t("filters.status")}
                </label>
                <Select
                  value={state.statusFilter ?? "all"}
                  onValueChange={(v) => {
                    onChange("statusFilter", v === "all" ? null : v)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>{t("filters.allStatuses")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("filters.allStatuses")}
                    </SelectItem>
                    {statuses?.map((s) => (
                      <SelectItem key={s.uuid} value={s.uuid}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {activeFilterCount > 0 && (
                <>
                  <Separator />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="w-full"
                  >
                    {t("filters.clearAllFilters")}
                  </Button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu
          open={sortFieldPopoverOpen}
          onOpenChange={setSortFieldPopoverOpen}
        >
          <ButtonGroup className="shrink-0 text-sm">
            <DropdownMenuTrigger
              render={
                <Button
                  className="min-w-[100px] justify-between text-xs font-normal"
                  variant="outline"
                >
                  {
                    sortFieldOptions.find((o) => o.value === state.sortField)
                      ?.label
                  }
                  <IconChevronDown className="h-3 w-3" />
                </Button>
              }
            />
            <Button
              variant="outline"
              onClick={() => {
                onChange(
                  "sortDirection",
                  state.sortDirection === "asc" ? "desc" : "asc",
                )
              }}
            >
              {state.sortDirection === "asc" ? (
                <IconArrowUp className="h-3 w-3" />
              ) : (
                <IconArrowDown className="h-3 w-3" />
              )}
            </Button>
          </ButtonGroup>
          <DropdownMenuContent>
            {sortFieldOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                className="justify-between"
                onClick={() => {
                  if (option.value === state.sortField) {
                    onChange(
                      "sortDirection",
                      state.sortDirection === "asc" ? "desc" : "asc",
                    )
                  } else {
                    onChange("sortField", option.value)
                    onChange("sortDirection", "desc")
                  }
                }}
              >
                <span>{option.label} </span>
                {option.value === state.sortField ? (
                  state.sortDirection === "asc" ? (
                    <IconArrowUp className="h-3 w-3" />
                  ) : (
                    <IconArrowDown className="h-3 w-3" />
                  )
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {onDisplayOverrideChange && (
          <Select
            value={displayOverride ?? DISPLAY_AUTO}
            onValueChange={(value) => {
              onDisplayOverrideChange(
                value === DISPLAY_AUTO ? null : (value as DisplayField),
              )
            }}
          >
            <SelectTrigger className="h-8 min-w-[110px] text-xs font-normal">
              <span className="text-muted-foreground mr-1">Show</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DISPLAY_AUTO}>Auto</SelectItem>
              {DISPLAY_OVERRIDE_FIELDS.map((field) => (
                <SelectItem key={field} value={field}>
                  {DISPLAY_FIELD_LABELS[field]}
                </SelectItem>
              ))}
              {hasSeriesContext && (
                <SelectItem value="seriesPosition">
                  {DISPLAY_FIELD_LABELS.seriesPosition}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="scroll-x flex items-center gap-1.5">
        {mediaFilterOptions.map((opt) => {
          const isActive = state.mediaFilter === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => {
                onChange("mediaFilter", opt.value)
              }}
              className={cn(
                "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted text-muted-foreground hover:bg-muted-foreground/15 hover:text-foreground border-transparent",
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          )
        })}

        {(activeCollection || activeSeries || activeStatus) && (
          <div className="bg-border mx-1 h-4 w-px shrink-0" />
        )}

        {activeCollection && (
          <button
            onClick={() => {
              onChange("collectionFilter", null)
            }}
            className="border-primary/30 bg-primary/10 text-primary inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
          >
            {activeCollection.name}
            <IconX className="h-3 w-3" />
          </button>
        )}

        {activeSeries && (
          <button
            onClick={() => {
              onChange("seriesFilter", null)
            }}
            className="border-primary/30 bg-primary/10 text-primary inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
          >
            {activeSeries.name}
            <IconX className="h-3 w-3" />
          </button>
        )}

        {activeStatus && (
          <button
            onClick={() => {
              onChange("statusFilter", null)
            }}
            className="border-primary/30 bg-primary/10 text-primary inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
          >
            {activeStatus.name}
            <IconX className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}

export function getActiveFilterCount(
  state: BookFiltersState,
  options?: { hideCollectionFilter?: boolean; hideSeriesFilter?: boolean },
): number {
  return [
    state.mediaFilter !== "all",
    !options?.hideCollectionFilter && state.collectionFilter,
    !options?.hideSeriesFilter && state.seriesFilter,
    state.statusFilter,
  ].filter(Boolean).length
}
