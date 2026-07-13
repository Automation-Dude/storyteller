"use client"

import {
  createParser,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from "nuqs"
import { useCallback, useDeferredValue, useMemo } from "react"

import {
  type ShelfFilterAnd,
  type ShelfFilterCondition,
  type ShelfFilterField,
  type ShelfFilterNode,
  createAndBlock,
  shelfFilterRootSchema,
} from "@/shelves"
import {
  DISPLAY_FIELDS,
  type DisplayField,
  type SortDirection,
  type SortField,
} from "@/sort"
import { type ListBooksQueryArg } from "@/store/api"
import { type UUID } from "@/uuid"

import { useDebounce } from "./use-debounce"

// ---------------------------------------------------------------------------
// the single owner of a book list's filter + sort + display, backed by the url.
//
// the filter is ONE ShelfFilter tree (the same shape shelves + the advanced
// editor use). the quick chips edit the top-level `and` conditions; the
// advanced editor edits the whole tree. an optional locked `seed` (series /
// collection / shelf page) is ANDed in but never editable. everything is
// serialized to the url with shallow + replace so changing a filter never runs
// the server loader or pushes a history entry.
// ---------------------------------------------------------------------------

type UseBookFiltersOptions = {
  // a locked condition contributed by the page context (e.g. "series is Dune").
  // rendered as a non-removable chip and always ANDed into the query.
  seed?: ShelfFilterNode | null
  // native sort-context args so getBooks can resolve series-position ordering
  // and reuse its membership filters. orthogonal to the filter tree.
  seriesContext?: UUID
  collectionContext?: UUID
  defaultSortField?: SortField
  defaultSortDirection?: SortDirection
}

type Sort = { field: SortField; direction: SortDirection }

const sortParser = createParser<Sort>({
  parse(queryValue) {
    const [field, direction] = queryValue.split(":")
    if (!field) return null
    if (direction !== "asc" && direction !== "desc") return null
    return { field: field as SortField, direction }
  },
  serialize(value) {
    return `${value.field}:${value.direction}`
  },
  eq(a, b) {
    return a.field === b.field && a.direction === b.direction
  },
}).withOptions({ shallow: true, history: "replace" })

// the user portion of the filter, serialized as compact json in a single param.
// validated against the strict root schema on parse; anything malformed falls
// back to an empty `and` block. forward-compatible: a future tag:foo query
// syntax becomes the codec for this same param without touching the tree shape.
const EMPTY_FILTER: ShelfFilterAnd = createAndBlock([])

const filterParser = createParser({
  parse(queryValue): ShelfFilterNode | null {
    try {
      const parsed: unknown = JSON.parse(queryValue)
      const result = shelfFilterRootSchema.safeParse(parsed)
      if (!result.success) return null
      return result.data as ShelfFilterNode
    } catch {
      return null
    }
  },
  serialize(value: ShelfFilterNode) {
    return JSON.stringify(value)
  },
  eq(a, b) {
    return JSON.stringify(a) === JSON.stringify(b)
  },
})
  .withOptions({ shallow: true, history: "replace" })
  .withDefault(EMPTY_FILTER)

// a top-level node that is a simple condition the quick chips can edit.
function isConditionNode(node: ShelfFilterNode): node is ShelfFilterCondition {
  return node.type === "condition"
}

// the quick chips can only represent a flat `and` of conditions. anything else
// (an or / not / nested block authored in the advanced editor) is shown as a
// single locked "Advanced" chip.
function asSimpleAnd(node: ShelfFilterNode): ShelfFilterCondition[] | null {
  if (node.type !== "and") return null
  if (!node.children.every(isConditionNode)) return null
  return node.children
}

// replace every condition targeting `field` with `conds`, in place (so editing a
// chip never reorders the others).
function replaceFieldConditions(
  children: ShelfFilterNode[],
  field: ShelfFilterField,
  conds: ShelfFilterCondition[],
): ShelfFilterNode[] {
  const out: ShelfFilterNode[] = []
  let inserted = false
  for (const child of children) {
    if (child.type === "condition" && child.field === field) {
      if (!inserted) {
        out.push(...conds)
        inserted = true
      }
      continue
    }
    out.push(child)
  }
  if (!inserted) out.push(...conds)
  return out
}

export function useBookFilters(options: UseBookFiltersOptions = {}) {
  const [userFilter, setUserFilterRaw] = useQueryState("f", filterParser)
  const [search, setSearchRaw] = useQueryState(
    "search",
    parseAsString.withDefault("").withOptions({
      shallow: true,
      history: "replace",
    }),
  )
  const [sort, setSortRaw] = useQueryState(
    "sort",
    sortParser.withDefault({
      field: options.defaultSortField ?? "createdAt",
      direction: options.defaultSortDirection ?? "desc",
    }),
  )
  const [displayOverrides, setDisplayOverrides] = useQueryState(
    "display",
    parseAsArrayOf(parseAsStringLiteral(DISPLAY_FIELDS)).withOptions({
      shallow: true,
      history: "replace",
    }),
  )

  const debouncedSearch = useDebounce(search, 200)
  const deferredSearch = useDeferredValue(debouncedSearch)
  const isSearching = debouncedSearch !== deferredSearch

  // the flat condition list the quick chips edit, or null when the tree is too
  // complex for the chips (advanced mode).
  const simpleConditions = useMemo(() => asSimpleAnd(userFilter), [userFilter])
  const isAdvanced = simpleConditions === null

  // the fields with at least one active condition, in tree order (for chips).
  const activeFields = useMemo(() => {
    if (!simpleConditions) return []
    const seen = new Set<ShelfFilterField>()
    const order: ShelfFilterField[] = []
    for (const c of simpleConditions) {
      if (!seen.has(c.field)) {
        seen.add(c.field)
        order.push(c.field)
      }
    }
    return order
  }, [simpleConditions])

  const conditionsForField = useCallback(
    (field: ShelfFilterField): ShelfFilterCondition[] =>
      simpleConditions?.filter((c) => c.field === field) ?? [],
    [simpleConditions],
  )

  const setConditionsForField = useCallback(
    (field: ShelfFilterField, conds: ShelfFilterCondition[]) => {
      void setUserFilterRaw((prev) => {
        const root = prev
        if (root.type !== "and") return root
        const next = replaceFieldConditions(root.children, field, conds)
        return next.length ? { type: "and", children: next } : EMPTY_FILTER
      })
    },
    [setUserFilterRaw],
  )

  const removeField = useCallback(
    (field: ShelfFilterField) => {
      setConditionsForField(field, [])
    },
    [setConditionsForField],
  )

  const setUserFilter = useCallback(
    (node: ShelfFilterNode | null) => {
      void setUserFilterRaw(node ?? EMPTY_FILTER)
    },
    [setUserFilterRaw],
  )

  const setSearch = useCallback(
    (value: string) => {
      void setSearchRaw(value)
    },
    [setSearchRaw],
  )

  const setSort = useCallback(
    (field: SortField, direction: SortDirection) => {
      void setSortRaw({ field, direction })
    },
    [setSortRaw],
  )

  const clearAll = useCallback(() => {
    void setUserFilterRaw(EMPTY_FILTER)
    void setSearchRaw("")
  }, [setUserFilterRaw, setSearchRaw])

  // the user's tree has content when it's a non-empty and-block or any
  // or/not/nested structure.
  const userHasContent =
    userFilter.type !== "and" || userFilter.children.length > 0

  // seed (locked) AND user. either side may be absent.
  const effectiveFilter = useMemo<ShelfFilterNode | undefined>(() => {
    const seed = options.seed ?? null
    if (seed && userHasContent)
      return { type: "and", children: [seed, userFilter] }
    if (seed) return seed
    if (userHasContent) return userFilter
    return undefined
  }, [options.seed, userFilter, userHasContent])

  const queryArg = useMemo<ListBooksQueryArg>(() => {
    const arg: ListBooksQueryArg = {
      orderBy: sort.field,
      orderDirection: sort.direction,
    }
    if (deferredSearch) arg.search = deferredSearch
    if (effectiveFilter) arg.filter = effectiveFilter
    if (options.seriesContext) arg.series = options.seriesContext
    if (options.collectionContext) arg.collection = options.collectionContext
    return arg
  }, [
    sort,
    deferredSearch,
    effectiveFilter,
    options.seriesContext,
    options.collectionContext,
  ])

  const activeFilterCount = isAdvanced
    ? 1
    : activeFields.length + (search ? 1 : 0)

  return {
    // filter tree
    userFilter,
    isAdvanced,
    seed: options.seed ?? null,
    effectiveFilter,
    activeFields,
    conditionsForField,
    setConditionsForField,
    removeField,
    setUserFilter,
    // search / sort / display
    search,
    setSearch,
    sort,
    setSort,
    displayOverrides,
    setDisplayOverrides,
    // query + status
    queryArg,
    isSearching,
    deferredSearch,
    activeFilterCount,
    clearAll,
  }
}

export type BookFiltersController = ReturnType<typeof useBookFilters>
export type { DisplayField, SortDirection, SortField }
