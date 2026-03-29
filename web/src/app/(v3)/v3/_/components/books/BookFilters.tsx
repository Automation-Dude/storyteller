import {
  IconArrowDown,
  IconArrowUp,
  IconBook,
  IconFilter,
  IconHeadphones,
  IconRefresh,
} from "@tabler/icons-react"
import { useState } from "react"

import { Badge } from "@/app/(v3)/v3/_/components/ui/badge"
import { Button } from "@/app/(v3)/v3/_/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/(v3)/v3/_/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/(v3)/v3/_/components/ui/select"
import {
  type MediaFilter,
  // type ShelfFilterCondition,
  // type ShelfFilterNode,
  // type ShelfOrderBy,
  // useCreateUserShelfMutation,
  useListCollectionsQuery,
  useListSeriesQuery,
  useListStatusesQuery,
} from "@/store/api"

// import { ColumnSelector } from "@v3/_/components/books/ColumnSelector"
// import { ViewSelector } from "@v3/_/components/books/ViewSelector"
import { ButtonGroup } from "@v3/_/components/ui/button-group"
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@v3/_/components/ui/dialog"
// import { Label } from "@v3/_/components/ui/label"
import { Separator } from "@v3/_/components/ui/separator"
import { SearchInput } from "./SearchInput"

export type SortField = "createdAt" | "updatedAt" | "title" | "publicationDate"
export type SortDirection = "asc" | "desc"

export const sortFieldOptions: { value: SortField; label: string }[] = [
  { value: "createdAt", label: "Date Added" },
  { value: "updatedAt", label: "Date Updated" },
  { value: "title", label: "Title" },
  { value: "publicationDate", label: "Publication Date" },
]

const mediaFilterOptions: {
  value: MediaFilter
  label: string
  icon: React.ReactNode
}[] = [
  { value: "all", label: "All Media", icon: null },
  {
    value: "ebook",
    label: "Ebook Only",
    icon: <IconBook className="h-4 w-4" />,
  },
  {
    value: "audiobook",
    label: "Audiobook Only",
    icon: <IconHeadphones className="h-4 w-4" />,
  },
  {
    value: "readaloud",
    label: "ReadAloud",
    icon: <IconRefresh className="h-4 w-4" />,
  },
]

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
}

function buildShelfFilter(state: BookFiltersState): ShelfFilterNode | null {
  const conditions: ShelfFilterCondition[] = []

  if (state.searchInput) {
    conditions.push({
      type: "condition",
      field: "title",
      operator: "contains",
      value: state.searchInput,
    })
  }

  if (state.mediaFilter !== "all") {
    conditions.push({
      type: "condition",
      field: "mediaType",
      operator: "is",
      value: state.mediaFilter,
    })
  }

  if (state.collectionFilter) {
    conditions.push({
      type: "condition",
      field: "collections",
      operator: "includes",
      value: [state.collectionFilter],
    })
  }

  if (state.seriesFilter) {
    conditions.push({
      type: "condition",
      field: "series",
      operator: "includes",
      value: [state.seriesFilter],
    })
  }

  if (state.statusFilter) {
    conditions.push({
      type: "condition",
      field: "status",
      operator: "is",
      value: state.statusFilter,
    })
  }

  if (conditions.length === 0) return null
  if (conditions.length === 1) return conditions[0]!
  return { type: "and", children: conditions }
}

export function BookFilters({
  state,
  onChange,
  filterPopoverOpen,
  setFilterPopoverOpen,
  hideCollectionFilter = false,
  hideSeriesFilter = false,
  showSaveSearch = false,
}: BookFiltersProps) {
  const { data: collections } = useListCollectionsQuery()
  const { data: seriesList } = useListSeriesQuery()
  const { data: statuses } = useListStatusesQuery()
  // const [createShelf, { isLoading: isCreatingShelf }] =
  // useCreateUserShelfMutation()
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [searchName, setSearchName] = useState("")

  const activeFilterCount = [
    state.mediaFilter !== "all",
    !hideCollectionFilter && state.collectionFilter,
    !hideSeriesFilter && state.seriesFilter,
    state.statusFilter,
  ].filter(Boolean).length

  const isDefaultSort =
    state.sortField === "createdAt" && state.sortDirection === "desc"
  const hasAnyFilter =
    activeFilterCount > 0 || state.searchInput || !isDefaultSort

  const clearFilters = () => {
    onChange("mediaFilter", "all")
    if (!hideCollectionFilter) onChange("collectionFilter", null)
    if (!hideSeriesFilter) onChange("seriesFilter", null)
    onChange("statusFilter", null)
  }

  // const handleSaveSearch = async () => {
  //   if (!searchName.trim()) return
  //   const filter = buildShelfFilter(state)

  //   const sortFieldToOrderBy: Record<SortField, ShelfOrderBy> = {
  //     createdAt: "createdAt",
  //     updatedAt: "updatedAt",
  //     title: "title",
  //     publicationDate: "publicationDate",
  //   }

  //   await createShelf({
  //     name: searchName.trim(),
  //     filter,
  //     orderBy: sortFieldToOrderBy[state.sortField],
  //     orderDirection: state.sortDirection,
  //   }).unwrap()

  //   setSearchName("")
  //   setSaveDialogOpen(false)
  // }

  return (
    <div className="bg-background/95 sticky top-0 z-50 mx-1 backdrop-blur">
      <div className="flex flex-col gap-3 px-3 py-1 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          placeholder="Search books, authors, series..."
          value={state.searchInput}
          onChange={(value) => {
            onChange("searchInput", value)
          }}
        />
        <div className="flex items-center gap-2">
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger
              render={
                <Button variant="ghost" size="sm" className="gap-2">
                  <IconFilter className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              }
            />
            <PopoverContent className="w-80" align="end">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Media Type</label>
                  <Select
                    value={state.mediaFilter}
                    onValueChange={(v) => {
                      onChange("mediaFilter", v as MediaFilter)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mediaFilterOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            {option.icon}
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!hideCollectionFilter && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Collection</label>
                      <Select
                        value={state.collectionFilter ?? "all"}
                        onValueChange={(v) => {
                          onChange("collectionFilter", v === "all" ? null : v)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue>All Collections</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Collections</SelectItem>
                          {collections?.map((collection) => (
                            <SelectItem
                              key={collection.uuid}
                              value={collection.uuid}
                            >
                              {collection.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {!hideSeriesFilter && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Series</label>
                      <Select
                        value={state.seriesFilter ?? "all"}
                        onValueChange={(v) => {
                          onChange("seriesFilter", v === "all" ? null : v)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue>All Series</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Series</SelectItem>
                          {seriesList?.map((series) => (
                            <SelectItem key={series.uuid} value={series.uuid}>
                              {series.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <Separator />

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Reading Status</label>
                  <Select
                    value={state.statusFilter ?? "all"}
                    onValueChange={(v) => {
                      onChange("statusFilter", v === "all" ? null : v)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>All Statuses</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {statuses?.map((status) => (
                        <SelectItem key={status.uuid} value={status.uuid}>
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {activeFilterCount > 0 && (
                  <>
                    <Separator />
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear All Filters
                    </Button>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Select
            value={state.sortField}
            onValueChange={(value) => {
              onChange("sortField", value as SortField)
            }}
          >
            <SelectTrigger
              className="w-[120px] border-0 bg-transparent"
              size="sm"
            >
              <SelectValue>
                {
                  sortFieldOptions.find(
                    (option) => option.value === state.sortField,
                  )?.label
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sortFieldOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ButtonGroup>
            <Button
              size="sm"
              onClick={() => {
                onChange(
                  "sortDirection",
                  state.sortDirection === "asc" ? "desc" : "asc",
                )
              }}
            >
              {state.sortDirection === "asc" ? (
                <IconArrowUp className="h-4 w-4" />
              ) : (
                <IconArrowDown className="h-4 w-4" />
              )}
            </Button>
          </ButtonGroup>

          {/* {showSaveSearch && hasAnyFilter && (
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Bookmark className="h-4 w-4" />
                  Save as Shelf
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save as Shelf</DialogTitle>
                  <DialogDescription>
                    Create a shelf with the current search and filters for quick
                    access later.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="search-name">Name</Label>
                    <Input
                      id="search-name"
                      placeholder="e.g., Audiobooks, Fantasy series..."
                      value={searchName}
                      onChange={(e) => {
                        setSearchName(e.target.value)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isCreatingShelf) {
                          handleSaveSearch()
                        }
                      }}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSaveDialogOpen(false)
                    }}
                    disabled={isCreatingShelf}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveSearch}
                    disabled={!searchName.trim() || isCreatingShelf}
                  >
                    {isCreatingShelf ? "Creating..." : "Create Shelf"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )} */}

          {/* <ColumnSelector /> */}
          {/* <ViewSelector /> */}
        </div>
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
