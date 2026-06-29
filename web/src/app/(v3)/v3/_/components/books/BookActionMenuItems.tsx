"use client"

import {
  IconArrowMerge,
  IconBook,
  IconFolder,
  IconFolderMinus,
  IconLibrary,
  IconLibraryMinus,
  IconPlus,
  IconProgress,
  IconRefresh,
  IconReplace,
  IconScan,
  IconTag,
  IconTagOff,
  IconTrash,
} from "@tabler/icons-react"
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react"
import { toast } from "sonner"

import { type BookWithRelations, type CreatorRelation } from "@/database/books"
import { usePermissions } from "@/hooks/usePermissions"
import {
  useAddBooksToCollectionsMutation,
  useAddBooksToSeriesMutation,
  useAddTagsToBooksMutation,
  useClearBooksCacheMutation,
  useDeleteBooksMutation,
  useGetCurrentUserQuery,
  useListCollectionsQuery,
  useListSeriesQuery,
  useListStatusesQuery,
  useListTagsQuery,
  useMergeBooksMutation,
  useProcessBookMutation,
  useRemoveBooksFromCollectionsMutation,
  useRemoveBooksFromSeriesMutation,
  useRemoveTagsFromBooksMutation,
  useScanBooksMutation,
  useUpdateReadingStatusMutation,
  useUpgradeBookEpubMutation,
} from "@/store/api"
import { type UUID } from "@/uuid"

import {
  ConfirmDialog,
  useConfirmAction,
} from "@v3/_/components/ui/confirm-dialog"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { Input } from "@v3/_/components/ui/input"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { ProcessingModal } from "./BookDetails/ProcessingModal"
import { CreateCollectionDialog } from "./CreateCollectionDialog"
import { CreateTagDialog } from "./CreateTagDialog"
import { CreateSeriesDialog } from "./_CreateSeriesDialog"

type Mode = "single" | "bulk"

// dedupe a list of {uuid,name} relations across all selected books, so the
// "remove from..." submenus only list relations the selection actually has.
function dedupeRelations(
  items: { uuid: string; name: string }[],
): { uuid: UUID; name: string }[] {
  const seen = new Map<string, string>()
  for (const item of items) {
    if (!seen.has(item.uuid)) seen.set(item.uuid, item.name)
  }
  return Array.from(seen, ([uuid, name]) => ({ uuid: uuid as UUID, name }))
}

type ActionOption = { id: string; name: string }

function ActionSubmenu({
  icon,
  label,
  options,
  onSelect,
  createLabel,
  onCreate,
}: {
  icon: ReactNode
  label: string
  options: ActionOption[]
  onSelect: (id: string, event: MouseEvent) => void
  createLabel?: string
  onCreate?: () => void
}) {
  const t = useTranslation("BookActions")
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return options
    return options.filter((option) => option.name.toLowerCase().includes(term))
  }, [options, search])

  // TODO: this is fukcing jank
  return (
    <DropdownMenuSub
      open={open}
      onOpenChange={(next, eventDetails) => {
        if (eventDetails.reason === "trigger-hover") {
          setOpen(true)
          return
        }

        setOpen(next)
        if (!next) setSearch("")
      }}
    >
      <DropdownMenuSubTrigger>
        {icon}
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-60 p-1">
        <div
          onKeyDown={(e) => {
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.stopPropagation()
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
          }}
        >
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
            }}
            placeholder={t("search")}
            className="mb-1 h-8"
          />
          <div className="scroll-y flex max-h-56 flex-col gap-0.5">
            {onCreate && createLabel && (
              <button
                type="button"
                onClick={() => {
                  onCreate()
                  setOpen(false)
                }}
                className="hover:bg-accent text-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs"
              >
                <IconPlus className="h-3.5 w-3.5" />
                {createLabel}
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="text-muted-foreground px-2 py-1.5 text-xs">
                {t("noResults")}
              </div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={(event) => {
                    onSelect(option.id, event)
                    setOpen(false)
                  }}
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs"
                >
                  {option.name}
                </button>
              ))
            )}
          </div>
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

export function useBookActionItems({
  books,
  mode,
  onAfterDestructive,
}: {
  books: BookWithRelations[]
  mode: Mode
  onAfterDestructive?: () => void
}) {
  const t = useTranslation("BookActions")
  const permissions = usePermissions()
  const canUpdate = !!permissions?.bookUpdate
  const canDelete = !!permissions?.bookDelete
  const canProcess = !!permissions?.bookProcess
  const canCreateCollection = !!permissions?.collectionCreate

  const bookUuids = books.map((b) => b.uuid)
  const count = books.length

  const { data: collections = [] } = useListCollectionsQuery()
  const { data: series = [] } = useListSeriesQuery()
  const { data: tags = [] } = useListTagsQuery()
  const { data: statuses = [] } = useListStatusesQuery()
  const { data: currentUser } = useGetCurrentUserQuery()

  const [addToCollections] = useAddBooksToCollectionsMutation()
  const [removeFromCollections] = useRemoveBooksFromCollectionsMutation()
  const [addToSeries] = useAddBooksToSeriesMutation()
  const [removeFromSeries] = useRemoveBooksFromSeriesMutation()
  const [addTags] = useAddTagsToBooksMutation()
  const [removeTags] = useRemoveTagsFromBooksMutation()
  const [updateReadingStatus] = useUpdateReadingStatusMutation()
  const [scanBooks] = useScanBooksMutation()
  const [processBook] = useProcessBookMutation()
  const [clearCache] = useClearBooksCacheMutation()
  const [upgradeEpub] = useUpgradeBookEpubMutation()
  const [deleteBooks] = useDeleteBooksMutation()
  const [mergeBooks] = useMergeBooksMutation()

  const [processingModalOpen, setProcessingModalOpen] = useState(false)
  const [mergeTarget, setMergeTarget] = useState<BookWithRelations | null>(null)
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false)
  const [createSeriesOpen, setCreateSeriesOpen] = useState(false)
  const [createTagOpen, setCreateTagOpen] = useState(false)

  // relations present on the selection, for the "remove from..." submenus
  const usedCollections = dedupeRelations(books.flatMap((b) => b.collections))
  const usedSeries = dedupeRelations(books.flatMap((b) => b.series))
  const usedTags = dedupeRelations(books.flatMap((b) => b.tags))
  const epubBooks = books.filter((b) => b.ebook)

  // merge needs 2-3 books and no two books sharing a format
  const formatCounts = books.reduce(
    (acc, b) => ({
      ebook: acc.ebook + (b.ebook ? 1 : 0),
      audiobook: acc.audiobook + (b.audiobook ? 1 : 0),
      readaloud: acc.readaloud + (b.readaloud ? 1 : 0),
    }),
    { ebook: 0, audiobook: 0, readaloud: 0 },
  )
  const canMerge =
    mode === "bulk" &&
    count >= 2 &&
    count <= 3 &&
    formatCounts.ebook <= 1 &&
    formatCounts.audiobook <= 1 &&
    formatCounts.readaloud <= 1

  const handleScan = useCallback(() => {
    void scanBooks({ bookUuids, force: true })
  }, [scanBooks, bookUuids])

  const handleCollectionCreated = useCallback(
    (uuid: string) => {
      void addToCollections({ collections: [uuid as UUID], books: bookUuids })
    },
    [addToCollections, bookUuids],
  )

  const handleDelete = useCallback(async () => {
    await deleteBooks({ books: bookUuids }).unwrap()
    onAfterDestructive?.()
  }, [deleteBooks, bookUuids, onAfterDestructive])

  const handleClearCache = useCallback(async () => {
    await clearCache({ bookUuids }).unwrap()
  }, [clearCache, bookUuids])

  const handleProcess = useCallback(async () => {
    await Promise.all(
      bookUuids.map((uuid) => processBook({ uuid, restart: false }).unwrap()),
    )
  }, [processBook, bookUuids])

  const handleUpgrade = useCallback(async () => {
    await Promise.all(
      epubBooks.map((b) => upgradeEpub({ uuid: b.uuid }).unwrap()),
    )
    toast.success(t("upgradeStarted"))
  }, [upgradeEpub, epubBooks, t])

  const handleMerge = useCallback(async () => {
    if (!mergeTarget) return

    const creators: CreatorRelation[] = [
      ...mergeTarget.authors,
      ...mergeTarget.narrators,
      ...mergeTarget.creators,
    ]

    await mergeBooks({
      update: {
        title: mergeTarget.title,
        subtitle: mergeTarget.subtitle,
        language: mergeTarget.language,
        description: mergeTarget.description,
        publicationDate: mergeTarget.publicationDate,
      },
      relations: {
        creators,
        series: mergeTarget.series,
        collections: mergeTarget.collections.map((c) => c.uuid),
        tags: mergeTarget.tags.map((tag) => tag.name),
        ...(mergeTarget.status &&
          currentUser && {
            status: {
              statusUuid: mergeTarget.status.uuid,
              userId: currentUser.id,
            },
          }),
      },
      from: bookUuids,
    }).unwrap()

    onAfterDestructive?.()
  }, [mergeBooks, mergeTarget, currentUser, bookUuids, onAfterDestructive])

  const deleteAction = useConfirmAction({
    onConfirm: handleDelete,
    title: t("deleteTitle", { count }),
    description: t("deleteDescription"),
    confirmLabel: t("delete"),
    variant: "destructive",
  })

  const clearCacheAction = useConfirmAction({
    onConfirm: handleClearCache,
    title: t("clearCacheTitle", { count }),
    description: t("clearCacheDescription"),
    confirmLabel: t("clearCache"),
    variant: "destructive",
  })

  const processAction = useConfirmAction({
    onConfirm: handleProcess,
    title: t("processTitle", { count }),
    description: t("processDescription"),
    confirmLabel: t("process"),
  })

  const upgradeAction = useConfirmAction({
    onConfirm: handleUpgrade,
    title: t("upgradeTitle", { count: epubBooks.length }),
    description: t("upgradeDescription"),
    confirmLabel: t("upgradeEpub"),
  })

  const mergeAction = useConfirmAction({
    onConfirm: handleMerge,
    title: mergeTarget
      ? t("mergeTitle", { target: mergeTarget.title })
      : t("merge"),
    description: t("mergeDescription"),
    confirmLabel: t("merge"),
    variant: "destructive",
  })

  const handleMergeInto = useCallback(
    (target: BookWithRelations, event: MouseEvent) => {
      setMergeTarget(target)
      mergeAction.confirm(event)
    },
    [mergeAction],
  )

  const items = (
    <>
      {canMerge && (
        <ActionSubmenu
          icon={<IconArrowMerge className="mr-2 h-4 w-4" />}
          label={t("mergeInto")}
          options={books.map((book) => ({ id: book.uuid, name: book.title }))}
          onSelect={(id, event) => {
            const target = books.find((b) => b.uuid === id)
            if (target) handleMergeInto(target, event)
          }}
        />
      )}

      {canUpdate && (
        <>
          <ActionSubmenu
            icon={<IconFolder className="mr-2 h-4 w-4" />}
            label={t("addToCollection")}
            options={collections.map((c) => ({ id: c.uuid, name: c.name }))}
            onSelect={(id) => {
              void addToCollections({
                collections: [id as UUID],
                books: bookUuids,
              })
            }}
            createLabel={canCreateCollection ? t("newCollection") : undefined}
            onCreate={
              canCreateCollection
                ? () => {
                    setCreateCollectionOpen(true)
                  }
                : undefined
            }
          />

          {usedCollections.length > 0 && (
            <ActionSubmenu
              icon={<IconFolderMinus className="mr-2 h-4 w-4" />}
              label={t("removeFromCollection")}
              options={usedCollections.map((c) => ({
                id: c.uuid,
                name: c.name,
              }))}
              onSelect={(id) => {
                void removeFromCollections({
                  collections: [id as UUID],
                  books: bookUuids,
                })
              }}
            />
          )}

          <ActionSubmenu
            icon={<IconLibrary className="mr-2 h-4 w-4" />}
            label={t("addToSeries")}
            options={series.map((s) => ({ id: s.uuid, name: s.name }))}
            onSelect={(id) => {
              const target = series.find((s) => s.uuid === id)
              if (!target) return
              void addToSeries({
                series: { uuid: target.uuid, name: target.name },
                relations: bookUuids.map((bookUuid, index) => ({
                  bookUuid,
                  position: index + 1,
                  featured: false,
                })),
              })
            }}
            createLabel={t("newSeries")}
            onCreate={() => {
              setCreateSeriesOpen(true)
            }}
          />

          {usedSeries.length > 0 && (
            <ActionSubmenu
              icon={<IconLibraryMinus className="mr-2 h-4 w-4" />}
              label={t("removeFromSeries")}
              options={usedSeries.map((s) => ({ id: s.uuid, name: s.name }))}
              onSelect={(id) => {
                void removeFromSeries({
                  series: [id as UUID],
                  books: bookUuids,
                })
              }}
            />
          )}

          <ActionSubmenu
            icon={<IconTag className="mr-2 h-4 w-4" />}
            label={t("addTag")}
            options={tags.map((tag) => ({ id: tag.uuid, name: tag.name }))}
            onSelect={(id) => {
              const target = tags.find((tag) => tag.uuid === id)
              if (target)
                void addTags({ tags: [target.name], books: bookUuids })
            }}
            createLabel={t("newTag")}
            onCreate={() => {
              setCreateTagOpen(true)
            }}
          />

          {usedTags.length > 0 && (
            <ActionSubmenu
              icon={<IconTagOff className="mr-2 h-4 w-4" />}
              label={t("removeTag")}
              options={usedTags.map((tag) => ({
                id: tag.uuid,
                name: tag.name,
              }))}
              onSelect={(id) => {
                void removeTags({ tags: [id as UUID], books: bookUuids })
              }}
            />
          )}
        </>
      )}

      <ActionSubmenu
        icon={<IconBook className="mr-2 h-4 w-4" />}
        label={t("setStatus")}
        options={statuses.map((status) => ({
          id: status.uuid,
          name: status.name,
        }))}
        onSelect={(id) => {
          void updateReadingStatus({
            status: id as UUID,
            books: bookUuids,
          })
        }}
      />

      {canUpdate && epubBooks.length > 0 && (
        <DropdownMenuItem
          onClick={(event) => {
            upgradeAction.confirm(event)
          }}
        >
          <IconReplace className="mr-2 h-4 w-4" />
          {t("upgradeEpub")}
        </DropdownMenuItem>
      )}

      {canProcess &&
        (() => {
          const hasProcessable =
            mode === "bulk" || books.some((b) => b.audiobook || b.ebook)

          if (!hasProcessable) return null

          return (
            <>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={(event) => {
                  if (mode === "single") {
                    setProcessingModalOpen(true)
                  } else {
                    processAction.confirm(event)
                  }
                }}
              >
                <IconProgress className="mr-2 h-4 w-4" />
                {t("process")}
              </DropdownMenuItem>

              {mode === "bulk" && (
                <DropdownMenuItem
                  onClick={(event) => {
                    clearCacheAction.confirm(event)
                  }}
                >
                  <IconRefresh className="mr-2 h-4 w-4" />
                  {t("clearCache")}
                </DropdownMenuItem>
              )}
            </>
          )
        })()}

      {canProcess && (
        <DropdownMenuItem onClick={handleScan}>
          <IconScan className="mr-2 h-4 w-4" />
          {t("scan")}
        </DropdownMenuItem>
      )}

      {canDelete && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(event) => {
              deleteAction.confirm(event)
            }}
            disabled={deleteAction.isLoading}
            className="text-destructive focus:text-destructive"
          >
            <IconTrash className="mr-2 h-4 w-4" />
            {deleteAction.isLoading ? t("deleting") : t("delete")}
          </DropdownMenuItem>
        </>
      )}
    </>
  )

  const dialogs = (
    <>
      <ConfirmDialog {...deleteAction.dialogProps} />
      <ConfirmDialog {...clearCacheAction.dialogProps} />
      <ConfirmDialog {...processAction.dialogProps} />
      <ConfirmDialog {...upgradeAction.dialogProps} />
      <ConfirmDialog {...mergeAction.dialogProps} />

      {canCreateCollection && (
        <CreateCollectionDialog
          open={createCollectionOpen}
          onOpenChange={setCreateCollectionOpen}
          onCreated={handleCollectionCreated}
        />
      )}

      {canUpdate && (
        <>
          <CreateSeriesDialog
            open={createSeriesOpen}
            onOpenChange={setCreateSeriesOpen}
            books={bookUuids}
          />
          <CreateTagDialog
            open={createTagOpen}
            onOpenChange={setCreateTagOpen}
            books={bookUuids}
          />
        </>
      )}

      {mode === "single" && books[0] && (
        <ProcessingModal
          book={books[0]}
          aligned={!!books[0].readaloud?.filepath}
          open={processingModalOpen}
          onOpenChange={setProcessingModalOpen}
        />
      )}
    </>
  )

  return { items, dialogs }
}
