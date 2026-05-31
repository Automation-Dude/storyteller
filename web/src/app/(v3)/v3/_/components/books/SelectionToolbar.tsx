import {
  IconCheck,
  IconChevronDown,
  IconFolder,
  IconLibrary,
  IconPointer,
  IconRefresh,
  IconSquare,
  IconSquareCheck,
  IconTrash,
  IconX,
} from "@tabler/icons-react"
import { useCallback, useState } from "react"


import { Button } from "@v3/_/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { cn } from "@v3/_/lib/utils"

import { usePermissions } from "@/hooks/usePermissions"
import {
  useAddBooksToCollectionsMutation,
  useAddBooksToSeriesMutation,
  useDeleteBookMutation,
  useListCollectionsQuery,
  useListSeriesQuery,
  useScanBooksMutation,
} from "@/store/api"

type SelectionToolbarProps = {
  allBookUuids: string[]
  className?: string
}

export function SelectionToolbar({
  allBookUuids,
  className,
}: SelectionToolbarProps) {
  const permissions = usePermissions()
  const canUpdate = !!permissions?.bookUpdate
  const canDelete = !!permissions?.bookDelete
  const canProcess = !!permissions?.bookProcess

  const { data: collections = [] } = useListCollectionsQuery()
  const { data: series = [] } = useListSeriesQuery()
  const [addToCollections] = useAddBooksToCollectionsMutation()
  const [addToSeries] = useAddBooksToSeriesMutation()
  const [deleteBook] = useDeleteBookMutation()
  const [scanBooks] = useScanBooksMutation()

  const {
    selectedBooks,
    selectAll,
    selectNone,
    invertSelection,
    stopSelecting,
  } = useBookSelection()

  const isSelecting = selectedBooks.size > 0

  const [isDeleting, setIsDeleting] = useState(false)

  const selectedArray = Array.from(
    selectedBooks,
  ) as `${string}-${string}-${string}-${string}-${string}`[]
  const hasSelection = selectedBooks.size > 0

  const handleAddToCollection = useCallback(
    async (collectionUuid: string) => {
      await addToCollections({
        collections: [
          collectionUuid as `${string}-${string}-${string}-${string}-${string}`,
        ],
        books: selectedArray,
      })
    },
    [addToCollections, selectedArray],
  )

  const handleAddToSeries = useCallback(
    async (seriesUuid: string, seriesName: string) => {
      const relations = selectedArray.map((bookUuid, index) => ({
        bookUuid,
        position: index + 1,
        featured: false,
      }))
      await addToSeries({
        series: {
          uuid: seriesUuid as `${string}-${string}-${string}-${string}-${string}`,
          name: seriesName,
        },
        relations,
      })
    },
    [addToSeries, selectedArray],
  )

  const handleScanSelected = useCallback(async () => {
    await scanBooks({ bookUuids: selectedArray, force: true })
  }, [scanBooks, selectedArray])

  const handleDeleteSelected = useCallback(async () => {
    if (
      !confirm(`Delete ${selectedBooks.size} book(s)? This cannot be undone.`)
    ) {
      return
    }
    setIsDeleting(true)
    try {
      await Promise.all(
        selectedArray.map((uuid) => deleteBook({ uuid }).unwrap()),
      )
      selectNone()
    } finally {
      setIsDeleting(false)
    }
  }, [selectedArray, selectedBooks.size, deleteBook, selectNone])

  if (!isSelecting) return null

  return (
    <div
      className={cn(
        "bg-muted fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border p-2 shadow-lg",
        className,
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="sm" className="">
              <IconSquareCheck className="mr-2 h-4 w-4" />
              Select
              <IconChevronDown className="ml-2 h-4 w-4" />
            </Button>
          }
        />
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() => {
              selectAll(allBookUuids)
            }}
          >
            <IconCheck className="mr-2 h-4 w-4" />
            Select all
          </DropdownMenuItem>
          <DropdownMenuItem onClick={selectNone}>
            <IconSquare className="mr-2 h-4 w-4" />
            Select none
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              invertSelection(allBookUuids)
            }}
          >
            <IconSquareCheck className="mr-2 h-4 w-4" />
            Invert selection
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="p-2 font-sans text-xs whitespace-nowrap">
        {selectedBooks.size} selected
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="sm" disabled={!hasSelection}>
              <IconPointer className="mr-2 h-4 w-4" />
              Actions
              <IconChevronDown className="ml-2 h-4 w-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-[12rem]">
          {canUpdate && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <IconFolder className="mr-2 h-4 w-4" />
                Add to Collection
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                {collections.length === 0 ? (
                  <DropdownMenuItem disabled>No collections</DropdownMenuItem>
                ) : (
                  collections.map((collection) => (
                    <DropdownMenuItem
                      key={collection.uuid}
                      onClick={() => handleAddToCollection(collection.uuid)}
                    >
                      {collection.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {canUpdate && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <IconLibrary className="mr-2 h-4 w-4" />
                Add to Series
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                {series.length === 0 ? (
                  <DropdownMenuItem disabled>No series</DropdownMenuItem>
                ) : (
                  series.map((s) => (
                    <DropdownMenuItem
                      key={s.uuid}
                      onClick={() => handleAddToSeries(s.uuid, s.name)}
                    >
                      {s.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {canProcess && (
            <>
              {canUpdate && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={handleScanSelected}>
                <IconRefresh className="mr-2 h-4 w-4" />
                Scan
              </DropdownMenuItem>
            </>
          )}

          {canDelete && (canUpdate || canProcess ? <DropdownMenuSeparator /> : null)}

          {canDelete && (
            <DropdownMenuItem
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="text-destructive focus:text-destructive"
            >
              <IconTrash className="mr-2 h-4 w-4" />
              {isDeleting ? "Deleting..." : "Delete"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="sm" onClick={stopSelecting}>
        <IconX className="h-4 w-4" />
      </Button>
    </div>
  )
}
