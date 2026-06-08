"use client"

import {
  IconArrowMerge,
  IconBook,
  IconFolder,
  IconFolderMinus,
  IconLibrary,
  IconLibraryMinus,
  IconProgress,
  IconRefresh,
  IconReplace,
  IconScan,
  IconTag,
  IconTagOff,
  IconTrash,
} from "@tabler/icons-react"
import { type MouseEvent, useCallback, useState } from "react"
import { toast } from "sonner"

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
import { useTranslation } from "@v3/_/hooks/use-translation"

import {
  type BookWithRelations,
  type CreatorRelation,
} from "@/database/books"
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

import { ProcessingModal } from "./BookDetails/ProcessingModal"

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

// the single source of truth for book actions. returns the dropdown items
// (to render inside a DropdownMenuContent) and the dialogs (to render as a
// sibling, outside the menu, so they survive the menu closing). shared by the
// single-book ellipsis menu and the bulk selection toolbar; `merge` is the only
// bulk-only action.
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
    toast.success(t.plain("upgradeStarted"))
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
    title: t.plain("deleteTitle", { count }),
    description: t.plain("deleteDescription"),
    confirmLabel: t.plain("delete"),
    variant: "destructive",
  })

  const clearCacheAction = useConfirmAction({
    onConfirm: handleClearCache,
    title: t.plain("clearCacheTitle", { count }),
    description: t.plain("clearCacheDescription"),
    confirmLabel: t.plain("clearCache"),
    variant: "destructive",
  })

  const processAction = useConfirmAction({
    onConfirm: handleProcess,
    title: t.plain("processTitle", { count }),
    description: t.plain("processDescription"),
    confirmLabel: t.plain("process"),
  })

  const upgradeAction = useConfirmAction({
    onConfirm: handleUpgrade,
    title: t.plain("upgradeTitle", { count: epubBooks.length }),
    description: t.plain("upgradeDescription"),
    confirmLabel: t.plain("upgradeEpub"),
  })

  const mergeAction = useConfirmAction({
    onConfirm: handleMerge,
    title: mergeTarget
      ? t.plain("mergeTitle", { target: mergeTarget.title })
      : t.plain("merge"),
    description: t.plain("mergeDescription"),
    confirmLabel: t.plain("merge"),
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
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconArrowMerge className="mr-2 h-4 w-4" />
            {t.plain("mergeInto")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
            {books.map((book) => (
              <DropdownMenuItem
                key={book.uuid}
                onClick={(event) => {
                  handleMergeInto(book, event)
                }}
              >
                {book.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}

      {canUpdate && (
        <>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <IconFolder className="mr-2 h-4 w-4" />
              {t.plain("addToCollection")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
              {collections.length === 0 ? (
                <DropdownMenuItem disabled>
                  {t.plain("noCollections")}
                </DropdownMenuItem>
              ) : (
                collections.map((collection) => (
                  <DropdownMenuItem
                    key={collection.uuid}
                    onClick={() => {
                      void addToCollections({
                        collections: [collection.uuid],
                        books: bookUuids,
                      })
                    }}
                  >
                    {collection.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {usedCollections.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <IconFolderMinus className="mr-2 h-4 w-4" />
                {t.plain("removeFromCollection")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                {usedCollections.map((collection) => (
                  <DropdownMenuItem
                    key={collection.uuid}
                    onClick={() => {
                      void removeFromCollections({
                        collections: [collection.uuid],
                        books: bookUuids,
                      })
                    }}
                  >
                    {collection.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <IconLibrary className="mr-2 h-4 w-4" />
              {t.plain("addToSeries")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
              {series.length === 0 ? (
                <DropdownMenuItem disabled>
                  {t.plain("noSeries")}
                </DropdownMenuItem>
              ) : (
                series.map((s) => (
                  <DropdownMenuItem
                    key={s.uuid}
                    onClick={() => {
                      void addToSeries({
                        series: { uuid: s.uuid, name: s.name },
                        relations: bookUuids.map((bookUuid, index) => ({
                          bookUuid,
                          position: index + 1,
                          featured: false,
                        })),
                      })
                    }}
                  >
                    {s.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {usedSeries.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <IconLibraryMinus className="mr-2 h-4 w-4" />
                {t.plain("removeFromSeries")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                {usedSeries.map((s) => (
                  <DropdownMenuItem
                    key={s.uuid}
                    onClick={() => {
                      void removeFromSeries({
                        series: [s.uuid],
                        books: bookUuids,
                      })
                    }}
                  >
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <IconTag className="mr-2 h-4 w-4" />
              {t.plain("addTag")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
              {tags.length === 0 ? (
                <DropdownMenuItem disabled>{t.plain("noTags")}</DropdownMenuItem>
              ) : (
                tags.map((tag) => (
                  <DropdownMenuItem
                    key={tag.uuid}
                    onClick={() => {
                      void addTags({ tags: [tag.name], books: bookUuids })
                    }}
                  >
                    {tag.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {usedTags.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <IconTagOff className="mr-2 h-4 w-4" />
                {t.plain("removeTag")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                {usedTags.map((tag) => (
                  <DropdownMenuItem
                    key={tag.uuid}
                    onClick={() => {
                      void removeTags({ tags: [tag.uuid], books: bookUuids })
                    }}
                  >
                    {tag.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
        </>
      )}

      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <IconBook className="mr-2 h-4 w-4" />
          {t.plain("setStatus")}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
          {statuses.map((status) => (
            <DropdownMenuItem
              key={status.uuid}
              onClick={() => {
                void updateReadingStatus({
                  status: status.uuid,
                  books: bookUuids,
                })
              }}
            >
              {status.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      {canUpdate && epubBooks.length > 0 && (
        <DropdownMenuItem
          onClick={(event) => {
            upgradeAction.confirm(event)
          }}
        >
          <IconReplace className="mr-2 h-4 w-4" />
          {t.plain("upgradeEpub")}
        </DropdownMenuItem>
      )}

      {canProcess && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleScan}>
            <IconScan className="mr-2 h-4 w-4" />
            {t.plain("scan")}
          </DropdownMenuItem>

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
            {t.plain("process")}
          </DropdownMenuItem>

          {mode === "bulk" && (
            <DropdownMenuItem
              onClick={(event) => {
                clearCacheAction.confirm(event)
              }}
            >
              <IconRefresh className="mr-2 h-4 w-4" />
              {t.plain("clearCache")}
            </DropdownMenuItem>
          )}
        </>
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
            {deleteAction.isLoading ? t.plain("deleting") : t.plain("delete")}
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
