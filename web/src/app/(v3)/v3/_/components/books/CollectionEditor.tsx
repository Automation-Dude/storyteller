import { IconFolder, IconPlus, IconX } from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"

import { cn } from "@/cn"
import {
  useAddBooksToCollectionsMutation,
  useListCollectionsQuery,
  useRemoveBooksFromCollectionsMutation,
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

import { CreateCollectionDialog } from "./CreateCollectionDialog"

type CollectionEditorProps = {
  bookUuid: string
  collections: Array<{ uuid: string; name: string }>
  onUpdate: () => void
  editMode?: boolean
}

export function CollectionEditor({
  bookUuid,
  collections,
  onUpdate,
  editMode = false,
}: CollectionEditorProps) {
  const isMobile = useIsMobile()
  const { data: allCollections = [] } = useListCollectionsQuery()
  const [addToCollections] = useAddBooksToCollectionsMutation()
  const [removeFromCollections] = useRemoveBooksFromCollectionsMutation()
  const [search, setSearch] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  const canInteract = editMode || (!isMobile && isHovering)

  const t = useTranslations("BookDetailsPage.collections")
  const tLabels = useTranslations("Labels")

  const bookCollectionUuids = useMemo(
    () => new Set(collections.map((c) => c.uuid)),
    [collections],
  )

  const filteredCollections = useMemo(() => {
    const searchLower = search.toLowerCase()
    return allCollections.filter(
      (collection) =>
        !bookCollectionUuids.has(collection.uuid) &&
        collection.name.toLowerCase().includes(searchLower),
    )
  }, [allCollections, bookCollectionUuids, search])

  const handleAddToCollection = useCallback(
    async (collectionUuid: string) => {
      await addToCollections({
        collections: [
          collectionUuid as `${string}-${string}-${string}-${string}-${string}`,
        ],
        books: [
          bookUuid as `${string}-${string}-${string}-${string}-${string}`,
        ],
      })
      setSearch("")
      onUpdate()
    },
    [addToCollections, bookUuid, onUpdate],
  )

  const handleRemoveFromCollection = useCallback(
    async (collectionUuid: string) => {
      await removeFromCollections({
        collections: [
          collectionUuid as `${string}-${string}-${string}-${string}-${string}`,
        ],
        books: [
          bookUuid as `${string}-${string}-${string}-${string}-${string}`,
        ],
      })
      onUpdate()
    },
    [removeFromCollections, bookUuid, onUpdate],
  )

  const handleCollectionCreated = useCallback(
    async (uuid: string) => {
      await addToCollections({
        collections: [
          uuid as `${string}-${string}-${string}-${string}-${string}`,
        ],
        books: [
          bookUuid as `${string}-${string}-${string}-${string}-${string}`,
        ],
      })
      onUpdate()
    },
    [addToCollections, bookUuid, onUpdate],
  )

  return (
    <>
      <CreateCollectionDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handleCollectionCreated}
        initialName={search}
      />

      <div
        className="group/collections flex flex-wrap items-center gap-2"
        onMouseEnter={() => {
          setIsHovering(true)
        }}
        onMouseLeave={() => {
          setIsHovering(false)
        }}
      >
        {collections.map((collection) => (
          <Badge
            key={collection.uuid}
            variant="secondary"
            className={cn(
              "group/badge gap-1 transition-all",
              canInteract && "hover:pr-1",
            )}
          >
            <IconFolder className="h-3 w-3" />
            {collection.name}
            {canInteract && (
              <button
                type="button"
                aria-label={tLabels("delete.withInput", {
                  input: collection.name,
                })}
                onClick={() => handleRemoveFromCollection(collection.uuid)}
                className="hover:bg-destructive/20 ml-0.5 hidden rounded-full p-0.5 opacity-0 transition-opacity group-hover/badge:block group-hover/badge:opacity-100"
              >
                <IconX className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}

        {collections.length === 0 && !canInteract && (
          <span className="text-muted-foreground text-sm">
            {t("notInAnyCollections")}
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
                    !editMode &&
                      "opacity-0 group-hover/collections:opacity-100",
                  )}
                >
                  <IconPlus className="h-3 w-3" />
                </Button>
              }
            />
            <PopoverContent className="w-64 p-2" align="start">
              <Input
                placeholder={t("seachOrCreateCollection")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                }}
                className="mb-2"
              />
              <div className="max-h-48 overflow-y-auto">
                {filteredCollections.map((collection) => (
                  <button
                    key={collection.uuid}
                    type="button"
                    aria-label={tLabels("add.withInput", {
                      input: collection.name,
                    })}
                    onClick={() => {
                      void handleAddToCollection(collection.uuid)
                      setIsOpen(false)
                    }}
                    className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
                  >
                    <IconFolder className="h-3 w-3" />
                    {collection.name}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label={tLabels("create.withInput", {
                    input: `"${search.trim()}"`,
                  })}
                  onClick={() => {
                    setIsOpen(false)
                    setShowCreateDialog(true)
                  }}
                  className="hover:bg-accent text-primary flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
                >
                  <IconPlus className="h-3 w-3" />
                  {tLabels("create.withInput", { input: `"${search.trim()}"` })}
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </>
  )
}
