"use client"

import {
  IconBook,
  IconFolder,
  IconLibrary,
  IconProgress,
  IconRefresh,
  IconReplace,
  IconScan,
  IconTrash,
} from "@tabler/icons-react"
import { useCallback, useState } from "react"
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
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"

import { type BookWithRelations, type CreatorRelation } from "@/database/books"
import { usePermissions } from "@/hooks/usePermissions"
import {
  useAddBooksToCollectionsMutation,
  useClearBooksCacheMutation,
  useDeleteBooksMutation,
  useGetCurrentUserQuery,
  useMergeBooksMutation,
  useProcessBookMutation,
  useScanBooksMutation,
  useUpgradeBookEpubMutation,
} from "@/store/api"
import { type UUID } from "@/uuid"

import { ITag } from "../../ui/icon"
import { useProcessingRun } from "../BookDetails/useProcessingRun"
import { CreateCollectionDialog } from "../CreateCollectionDialog"
import { CreateSeriesDialog } from "../CreateSeriesDialog"
import { CreateTagDialog } from "../CreateTagDialog"
import { RelationEditMenu } from "../relation-picker/RelationEditMenu"

type Mode = "single" | "bulk"

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
  const tp = useTranslation("Processing")
  const c = useCommon()
  const permissions = usePermissions()
  const canUpdate = !!permissions?.bookUpdate
  const canDelete = !!permissions?.bookDelete
  const canProcess = !!permissions?.bookProcess
  const canCreateCollection = !!permissions?.collectionCreate

  const bookUuids = books.map((b) => b.uuid)
  const count = books.length

  const { data: currentUser } = useGetCurrentUserQuery()

  const [addToCollections] = useAddBooksToCollectionsMutation()
  const [scanBooks] = useScanBooksMutation()
  const [processBook] = useProcessBookMutation()
  const [clearCache] = useClearBooksCacheMutation()
  const [upgradeEpub] = useUpgradeBookEpubMutation()
  const [deleteBooks] = useDeleteBooksMutation()
  const [mergeBooks] = useMergeBooksMutation()

  const processingRun = useProcessingRun(
    mode === "single" ? books[0] : undefined,
  )
  const [mergeTarget, setMergeTarget] = useState<BookWithRelations | null>(null)
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false)
  const [createCollectionName, setCreateCollectionName] = useState("")
  const [createSeriesOpen, setCreateSeriesOpen] = useState(false)
  const [createSeriesName, setCreateSeriesName] = useState("")
  const [createTagOpen, setCreateTagOpen] = useState(false)
  const [createTagName, setCreateTagName] = useState("")

  const epubBooks = books.filter((b) => b.ebook)

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
    confirmLabel: c("actions.delete"),
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
    confirmLabel: c("states.processing"),
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

  const items = (
    <>
      {canUpdate && (
        <>
          <RelationEditMenu
            subMenu
            source="collections"
            books={books}
            searchPlaceholder={t.plain("search")}
            icon={<IconFolder className="mr-2 h-4 w-4" />}
            label={t.plain("editCollections")}
            {...(canCreateCollection && {
              onCreate: (name: string) => {
                setCreateCollectionName(name)
                setCreateCollectionOpen(true)
              },
              createLabel: () => t.plain("newCollection"),
            })}
          />

          <RelationEditMenu
            subMenu
            source="series"
            books={books}
            searchPlaceholder={t.plain("search")}
            icon={<IconLibrary className="mr-2 h-4 w-4" />}
            label={t.plain("editSeries")}
            onCreate={(name) => {
              setCreateSeriesName(name)
              setCreateSeriesOpen(true)
            }}
            createLabel={() => t.plain("newSeries")}
          />

          <RelationEditMenu
            subMenu
            source="tags"
            books={books}
            searchPlaceholder={t.plain("search")}
            icon={<ITag.add className="mr-2 h-4 w-4" />}
            label={t.plain("editTags")}
            onCreate={(name) => {
              setCreateTagName(name)
              setCreateTagOpen(true)
            }}
            createLabel={() => t.plain("newTag")}
          />
        </>
      )}

      <RelationEditMenu
        subMenu
        source="statuses"
        books={books}
        searchPlaceholder={t.plain("search")}
        icon={<IconBook className="mr-2 h-4 w-4" />}
        label={t.plain("setStatus")}
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
          const singleBook = mode === "single" ? books[0] : undefined
          // to process a book we need both source formats present (backend
          // rejects otherwise), or an existing readaloud to continue/re-sync.
          const hasProcessable =
            mode === "bulk"
              ? books.some((b) => b.audiobook || b.ebook)
              : !!singleBook &&
                ((!!singleBook.ebook &&
                  !singleBook.ebook.missing &&
                  !!singleBook.audiobook &&
                  !singleBook.audiobook.missing) ||
                  !!singleBook.readaloud)

          if (!hasProcessable) return null

          return (
            <>
              <DropdownMenuSeparator />

              {mode === "single" ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <IconProgress className="mr-2 h-4 w-4" />
                    {tp("menuTitle")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {processingRun.positions.map((position) => (
                      <DropdownMenuItem
                        key={position.key}
                        disabled={position.disabled}
                        onClick={() => {
                          processingRun.start(position.restart)
                        }}
                      >
                        {position.icon}
                        {tp(position.labelKey)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : (
                <DropdownMenuItem
                  onClick={(event) => {
                    processAction.confirm(event)
                  }}
                >
                  <IconProgress className="mr-2 h-4 w-4" />
                  {c("states.processing")}
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onClick={(event) => {
                  clearCacheAction.confirm(event)
                }}
              >
                <IconRefresh className="mr-2 h-4 w-4" />
                {t("clearCache")}
              </DropdownMenuItem>
            </>
          )
        })()}

      {canProcess && (
        <DropdownMenuItem onClick={handleScan}>
          <IconScan className="mr-2 h-4 w-4" />
          {c("actions.scan")}
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
            {deleteAction.isLoading
              ? c("states.deleting")
              : c("actions.delete")}
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
          initialName={createCollectionName}
          onCreated={handleCollectionCreated}
        />
      )}

      {canUpdate && (
        <>
          <CreateSeriesDialog
            open={createSeriesOpen}
            onOpenChange={setCreateSeriesOpen}
            initialName={createSeriesName}
            books={bookUuids}
          />
          <CreateTagDialog
            open={createTagOpen}
            onOpenChange={setCreateTagOpen}
            initialName={createTagName}
            books={bookUuids}
          />
        </>
      )}

      {processingRun.dialog}
    </>
  )

  return { items, dialogs }
}
