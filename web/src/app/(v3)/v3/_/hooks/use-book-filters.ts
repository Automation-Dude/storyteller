"use client"

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs"
import { useCallback, useDeferredValue, useMemo, useState } from "react"

import {
  type BookFiltersState,
  type SortDirection,
  type SortField,
} from "@v3/_/components/books"

import { type ListBooksQueryArg, type MediaFilter } from "@/store/api"

import { useDebounce } from "./use-debounce"

const mediaFilterValues = ["all", "ebook", "audiobook", "synced"] as const
const sortFieldValues = [
  "createdAt",
  "updatedAt",
  "title",
  "publicationDate",
] as const
const sortDirectionValues = ["asc", "desc"] as const

type UseBookFiltersOptions = {
  fixedCollection?: string
  fixedSeries?: string
}

export function useBookFilters(options: UseBookFiltersOptions = {}) {
  const [searchInput, setSearchInput] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  )
  const [sortField, setSortField] = useQueryState(
    "sortBy",
    parseAsStringLiteral(sortFieldValues).withDefault("createdAt"),
  )
  const [sortDirection, setSortDirection] = useQueryState(
    "sortDir",
    parseAsStringLiteral(sortDirectionValues).withDefault("desc"),
  )
  const [mediaFilter, setMediaFilter] = useQueryState(
    "media",
    parseAsStringLiteral(mediaFilterValues).withDefault("all"),
  )
  const [collectionFilter, setCollectionFilter] = useQueryState(
    "collection",
    parseAsString,
  )
  const [seriesFilter, setSeriesFilter] = useQueryState("series", parseAsString)
  const [statusFilter, setStatusFilter] = useQueryState("status", parseAsString)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)

  const debouncedSearch = useDebounce(searchInput, 100)
  const deferredSearch = useDeferredValue(debouncedSearch)
  const isSearching = debouncedSearch !== deferredSearch

  const state: BookFiltersState = {
    searchInput,
    sortField: sortField,
    sortDirection: sortDirection,
    mediaFilter: mediaFilter,
    collectionFilter: options.fixedCollection ?? collectionFilter,
    seriesFilter: options.fixedSeries ?? seriesFilter,
    statusFilter,
  }

  const onChange = <K extends keyof BookFiltersState>(
    key: K,
    value: BookFiltersState[K],
  ) => {
    switch (key) {
      case "searchInput":
        void setSearchInput(value)
        break
      case "sortField":
        void setSortField(value as SortField)
        break
      case "sortDirection":
        void setSortDirection(value as SortDirection)
        break
      case "mediaFilter":
        void setMediaFilter(value as MediaFilter)
        break
      case "collectionFilter":
        if (!options.fixedCollection) {
          void setCollectionFilter(value)
        }
        break
      case "seriesFilter":
        if (!options.fixedSeries) {
          void setSeriesFilter(value)
        }
        break
      case "statusFilter":
        void setStatusFilter(value)
        break
    }
  }

  const queryArg = useMemo(() => {
    const arg: ListBooksQueryArg = {}
    arg.orderBy = sortField
    arg.orderDirection = sortDirection
    if (deferredSearch) arg.search = deferredSearch
    if (mediaFilter !== "all") arg.mediaFilter = mediaFilter
    if (options.fixedCollection) {
      arg.collection = options.fixedCollection
    } else if (collectionFilter) {
      arg.collection = collectionFilter
    }
    if (options.fixedSeries) {
      arg.series = options.fixedSeries
    } else if (seriesFilter) {
      arg.series = seriesFilter
    }
    if (statusFilter) arg.statusFilter = statusFilter
    return arg
  }, [
    sortField,
    sortDirection,
    deferredSearch,
    mediaFilter,
    collectionFilter,
    seriesFilter,
    statusFilter,
    options.fixedCollection,
    options.fixedSeries,
  ])

  const activeFilterCount = [
    mediaFilter !== "all",
    !options.fixedCollection && collectionFilter,
    !options.fixedSeries && seriesFilter,
    statusFilter,
  ].filter(Boolean).length

  const clearFilters = () => {
    void setMediaFilter("all")
    if (!options.fixedCollection) void setCollectionFilter(null)
    if (!options.fixedSeries) void setSeriesFilter(null)
    void setStatusFilter(null)
  }

  const handleSortChange = useCallback(
    (field: SortField, direction: SortDirection) => {
      void setSortField(field)
      void setSortDirection(direction)
    },
    [setSortField, setSortDirection],
  )

  return {
    state,
    onChange,
    queryArg,
    isSearching,
    deferredSearch,
    activeFilterCount,
    clearFilters,
    filterPopoverOpen,
    setFilterPopoverOpen,
    handleSortChange,
  }
}
