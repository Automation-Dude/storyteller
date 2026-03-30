import { IconLibrary, IconPlus, IconX } from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"

import {
  useAddBooksToSeriesMutation,
  useListSeriesQuery,
  useRemoveBooksFromSeriesMutation,
} from "@/store/api"

import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import { Input } from "@v3/_/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@v3/_/components/ui/popover"
import { useIsMobile } from "@v3/_/hooks/use-mobile"
import { cn } from "@v3/_/lib/utils"

type SeriesWithPosition = {
  uuid: string
  name: string
  position: number | null
  featured: boolean
}

type SeriesEditorProps = {
  bookUuid: string
  series: SeriesWithPosition[]
  onUpdate: () => void
  editMode?: boolean
}

export function SeriesEditor({
  bookUuid,
  series,
  onUpdate,
  editMode = false,
}: SeriesEditorProps) {
  const isMobile = useIsMobile()
  const { data: allSeries = [] } = useListSeriesQuery()
  const [addToSeries] = useAddBooksToSeriesMutation()
  const [removeFromSeries] = useRemoveBooksFromSeriesMutation()
  const [search, setSearch] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  const t = useTranslations("BookDetailsPage.series")
  const tLabels = useTranslations("Labels")

  const canInteract = editMode || (!isMobile && isHovering)

  const bookSeriesUuids = useMemo(
    () => new Set(series.map((s) => s.uuid)),
    [series],
  )

  const filteredSeries = useMemo(() => {
    const searchLower = search.toLowerCase()
    return allSeries.filter(
      (s) =>
        !bookSeriesUuids.has(s.uuid) &&
        s.name.toLowerCase().includes(searchLower),
    )
  }, [allSeries, bookSeriesUuids, search])

  const handleAddToSeries = useCallback(
    async (seriesName: string, seriesUuid?: string) => {
      // add at the end of the series (no position specified means last)
      await addToSeries({
        series: seriesUuid
          ? {
              uuid: seriesUuid as `${string}-${string}-${string}-${string}-${string}`,
              name: seriesName,
            }
          : { name: seriesName },
        relations: [
          {
            bookUuid:
              bookUuid as `${string}-${string}-${string}-${string}-${string}`,
            position: null,
            featured: series.length === 0, // first series is featured
          },
        ],
      })
      setSearch("")
      onUpdate()
    },
    [addToSeries, bookUuid, series.length, onUpdate],
  )

  const handleRemoveFromSeries = useCallback(
    async (seriesUuid: string) => {
      await removeFromSeries({
        series: [
          seriesUuid as `${string}-${string}-${string}-${string}-${string}`,
        ],
        books: [
          bookUuid as `${string}-${string}-${string}-${string}-${string}`,
        ],
      })
      onUpdate()
    },
    [removeFromSeries, bookUuid, onUpdate],
  )

  return (
    <div
      className="group/series flex flex-wrap items-center gap-2"
      onMouseEnter={() => {
        setIsHovering(true)
      }}
      onMouseLeave={() => {
        setIsHovering(false)
      }}
    >
      {series.map((s) => (
        <Badge
          key={s.uuid}
          variant="outline"
          className={cn("group/badge gap-1 transition-all", "hover:pr-1")}
        >
          <IconLibrary className="h-3 w-3" />
          {s.name}
          {s.position !== null && (
            <span className="text-muted-foreground">#{s.position}</span>
          )}
          {canInteract && (
            <button
              type="button"
              aria-label={tLabels("delete.withInput", { input: s.name })}
              onClick={() => handleRemoveFromSeries(s.uuid)}
              className="hover:bg-destructive/20 ml-0.5 hidden rounded-full p-0.5 opacity-0 transition-opacity group-hover/badge:block group-hover/badge:opacity-100"
            >
              <IconX className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}

      {series.length === 0 && !canInteract && (
        <span className="text-muted-foreground text-sm">
          {t("notInAnySeries")}
        </span>
      )}

      {canInteract && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-5 w-5 rounded-full p-0 transition-opacity",
                  !editMode && "opacity-0 group-hover/series:opacity-100",
                )}
              >
                <IconPlus className="h-3 w-3" />
              </Button>
            }
          />
          <PopoverContent className="w-64 p-2" align="start">
            <Input
              placeholder={t("seachOrCreateSeries")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
              }}
              className="mb-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  void handleAddToSeries(search.trim())
                  setIsOpen(false)
                }
              }}
            />
            <div className="max-h-48 overflow-y-auto">
              {filteredSeries.map((s) => (
                <button
                  key={s.uuid}
                  type="button"
                  aria-label={tLabels("add.withInput", { input: s.name })}
                  onClick={() => {
                    void handleAddToSeries(s.name, s.uuid)
                    setIsOpen(false)
                  }}
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
                >
                  <IconLibrary className="h-3 w-3" />
                  {s.name}
                </button>
              ))}
              {search.trim() && !allSeries.some((s) => s.name === search) && (
                <button
                  type="button"
                  aria-label={tLabels("create.withInput", {
                    input: `"${search.trim()}"`,
                  })}
                  onClick={() => {
                    void handleAddToSeries(search.trim())
                    setIsOpen(false)
                  }}
                  className="hover:bg-accent text-primary flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
                >
                  <IconPlus className="h-3 w-3" />
                  {tLabels("create.withInput", { input: `"${search.trim()}"` })}
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
