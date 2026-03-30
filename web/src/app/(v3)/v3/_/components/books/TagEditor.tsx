import { IconPlus, IconTag, IconX } from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"

import { useIsMobile } from "@/app/(v3)/v3/_/hooks/use-mobile"
import {
  useAddTagsToBooksMutation,
  useListTagsQuery,
  useRemoveTagsFromBooksMutation,
} from "@/store/api"

import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import { Input } from "@v3/_/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@v3/_/components/ui/popover"
import { cn } from "@v3/_/lib/utils"

type TagEditorProps = {
  bookUuid: string
  tags: Array<{ uuid: string; name: string }>
  onUpdate: () => void
  editMode?: boolean
}

export function TagEditor({
  bookUuid,
  tags,
  onUpdate,
  editMode = false,
}: TagEditorProps) {
  const isMobile = useIsMobile()
  const { data: allTags = [] } = useListTagsQuery()
  const [addTags] = useAddTagsToBooksMutation()
  const [removeTags] = useRemoveTagsFromBooksMutation()
  const [search, setSearch] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  const canInteract = editMode || (!isMobile && isHovering)

  const t = useTranslations("BookDetailsPage.tags")
  const tLabels = useTranslations("Labels")

  const bookTagUuids = useMemo(() => new Set(tags.map((t) => t.uuid)), [tags])

  const filteredTags = useMemo(() => {
    const searchLower = search.toLowerCase()
    return allTags.filter(
      (tag) =>
        !bookTagUuids.has(tag.uuid) &&
        tag.name.toLowerCase().includes(searchLower),
    )
  }, [allTags, bookTagUuids, search])

  const handleAddTag = useCallback(
    async (tagName: string) => {
      await addTags({
        tags: [tagName],
        books: [
          bookUuid as `${string}-${string}-${string}-${string}-${string}`,
        ],
      })
      setSearch("")
      onUpdate()
    },
    [addTags, bookUuid, onUpdate],
  )

  const handleRemoveTag = useCallback(
    async (tagUuid: string) => {
      await removeTags({
        tags: [tagUuid as `${string}-${string}-${string}-${string}-${string}`],
        books: [
          bookUuid as `${string}-${string}-${string}-${string}-${string}`,
        ],
      })
      onUpdate()
    },
    [removeTags, bookUuid, onUpdate],
  )

  return (
    <div
      className="group/tags flex flex-wrap items-center gap-2"
      onMouseEnter={() => {
        setIsHovering(true)
      }}
      onMouseLeave={() => {
        setIsHovering(false)
      }}
    >
      {tags.map((tag) => (
        <Badge
          key={tag.uuid}
          variant="outline"
          className={cn(
            "group/badge gap-1 transition-all",
            canInteract && "hover:pr-1",
          )}
        >
          <IconTag className="h-3 w-3" />
          {tag.name}
          {canInteract && (
            <button
              type="button"
              aria-label={tLabels("delete.withInput", { input: tag.name })}
              onClick={() => handleRemoveTag(tag.uuid)}
              className="hover:bg-destructive/20 ml-0.5 hidden rounded-full p-0.5 opacity-0 transition-opacity group-hover/badge:block group-hover/badge:opacity-100"
            >
              <IconX className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}

      {tags.length === 0 && !canInteract && (
        <span className="text-muted-foreground text-sm">
          {t("notInAnyTags")}
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
                  !editMode && "opacity-0 group-hover/tags:opacity-100",
                )}
              >
                <IconPlus className="h-3 w-3" />
              </Button>
            }
          />
          <PopoverContent className="w-64 p-2" align="start">
            <Input
              placeholder={t("seachOrCreateTag")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
              }}
              className="mb-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  void handleAddTag(search.trim())
                  setIsOpen(false)
                }
              }}
            />
            <div className="max-h-48 overflow-y-auto">
              {filteredTags.map((tag) => (
                <button
                  key={tag.uuid}
                  type="button"
                  aria-label={tLabels("add.withInput", { input: tag.name })}
                  onClick={() => {
                    void handleAddTag(tag.name)
                    setIsOpen(false)
                  }}
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
                >
                  <IconTag className="h-3 w-3" />
                  {tag.name}
                </button>
              ))}
              {search.trim() && !allTags.some((t) => t.name === search) && (
                <button
                  type="button"
                  aria-label={tLabels("create.withInput", {
                    input: `"${search.trim()}"`,
                  })}
                  onClick={() => {
                    void handleAddTag(search.trim())
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
