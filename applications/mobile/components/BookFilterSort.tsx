import { ScrollView, View } from "react-native"

import {
  type BookFilters,
  type Facet,
  SORT_LABELS,
  type SortKey,
} from "@/hooks/useBookFilters"

import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Text } from "./ui/text"

// Long facet lists are unusable on a phone; the tail is reachable by searching.
const MAX_FACET_OPTIONS = 30

type FacetMenuProps = {
  label: string
  selected: string | null
  options: Facet[]
  onSelect: (value: string | null) => void
}

function FacetMenu({ label, selected, options, onSelect }: FacetMenuProps) {
  if (!options.length) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant={selected ? "default" : "outline"}
          className="mr-2"
        >
          <Text className="text-sm">{selected ?? label}</Text>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-96">
        <ScrollView>
          {selected && (
            <DropdownMenuItem
              onPress={() => {
                onSelect(null)
              }}
            >
              <Text className="text-sm font-semibold">Any {label}</Text>
            </DropdownMenuItem>
          )}
          {options.slice(0, MAX_FACET_OPTIONS).map((option) => (
            <DropdownMenuItem
              key={option.name}
              onPress={() => {
                onSelect(option.name === selected ? null : option.name)
              }}
            >
              <Text className="text-sm">
                {option.name} ({option.count})
              </Text>
            </DropdownMenuItem>
          ))}
        </ScrollView>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type Props = {
  filters: BookFilters
  setFilters: (update: (filters: BookFilters) => BookFilters) => void
  sort: SortKey
  setSort: (sort: SortKey) => void
  facets: { tags: Facet[]; authors: Facet[]; series: Facet[] }
  activeCount: number
  clear: () => void
}

export function BookFilterSort({
  filters,
  setFilters,
  sort,
  setSort,
  facets,
  activeCount,
  clear,
}: Props) {
  return (
    <View className="px-4 pb-2">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="mr-2">
              <Text className="text-sm">Sort: {SORT_LABELS[sort]}</Text>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <DropdownMenuItem
                key={key}
                onPress={() => {
                  setSort(key)
                }}
              >
                <Text
                  className={key === sort ? "text-sm font-semibold" : "text-sm"}
                >
                  {SORT_LABELS[key]}
                </Text>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <FacetMenu
          label="Genre"
          selected={filters.tag}
          options={facets.tags}
          onSelect={(tag) => {
            setFilters((current) => ({ ...current, tag }))
          }}
        />
        <FacetMenu
          label="Author"
          selected={filters.author}
          options={facets.authors}
          onSelect={(author) => {
            setFilters((current) => ({ ...current, author }))
          }}
        />
        <FacetMenu
          label="Series"
          selected={filters.series}
          options={facets.series}
          onSelect={(series) => {
            setFilters((current) => ({ ...current, series }))
          }}
        />

        {activeCount > 0 && (
          <Button size="sm" variant="ghost" onPress={clear}>
            <Text className="text-sm">Clear</Text>
          </Button>
        )}
      </ScrollView>
    </View>
  )
}
