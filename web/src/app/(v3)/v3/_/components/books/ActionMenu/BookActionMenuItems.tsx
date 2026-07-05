"use client"

import * as icon from "@/icons"
import { Fragment, type ReactNode, useCallback, useState } from "react"
import { toast } from "sonner"

import {
  ConfirmDialog,
  useConfirmAction,
} from "@v3/_/components/ui/confirm-dialog"
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

import {
  FilterableMenuItem,
  FilterableMenuSeparator,
} from "../../ui/filterable-menu"
import { ITag } from "../../ui/icon"
import { useProcessingRun } from "../BookDetails/useProcessingRun"
import { CreateCollectionDialog } from "../CreateCollectionDialog"
import { CreateSeriesDialog } from "../CreateSeriesDialog"
import { CreateTagDialog } from "../CreateTagDialog"
import {
  RelationEditPicker,
  membershipFromBooks,
} from "../relation-picker/RelationEditPicker"

type Mode = "single" | "bulk"

// action data emitted by the hook. every book-action surface renders it through
// ActionEntryList inside a (searchable) FilterableMenu, so they all behave the
// same. submenu content mounts lazily via FilterableMenuItem.
export type BookActionEntry = {
  key: string
  label: string
  icon?: ReactNode
  keywords?: string
  onSelect?: () => void
  submenu?: ReactNode | ((ctx: { close: () => void }) => ReactNode)
  variant?: "destructive"
  separatorBefore?: boolean
  disabled?: boolean
}

// shared row styling for hand-rolled submenu buttons (processing positions).
const actionRowClassName =
  "focus:bg-accent hover:bg-accent flex min-h-7 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-left text-xs/relaxed outline-hidden select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"

// renders action entries as FilterableMenu items. Drop it inside a
// `FilterableMenu` / `FilterableMenuContent` to get search + submenus for free.
export function ActionEntryList({ entries }: { entries: BookActionEntry[] }) {
  return (
    <>
      {entries.map((entry) => (
        <Fragment key={entry.key}>
          {entry.separatorBefore && <FilterableMenuSeparator />}
          <FilterableMenuItem
            icon={entry.icon}
            textValue={entry.label}
            keywords={entry.keywords}
            variant={entry.variant}
            disabled={entry.disabled}
            onSelect={entry.onSelect}
            submenu={entry.submenu}
          >
            {entry.label}
          </FilterableMenuItem>
        </Fragment>
      ))}
    </>
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

  const entries: BookActionEntry[] = []

  if (canUpdate) {
    entries.push({
      key: "collections",
      label: t.plain("editCollections"),
      icon: <icon.Folder className="size-4" />,
      submenu: () => (
        <RelationEditPicker
          source="collections"
          bookUuids={bookUuids}
          membership={membershipFromBooks(books, "collections")}
          enabled
          searchPlaceholder={t.plain("search")}
          {...(canCreateCollection && {
            onCreate: (name: string) => {
              setCreateCollectionName(name)
              setCreateCollectionOpen(true)
            },
            createLabel: () => t.plain("newCollection"),
          })}
        />
      ),
    })

    entries.push({
      key: "series",
      label: t.plain("editSeries"),
      icon: <icon.Library className="size-4" />,
      submenu: () => (
        <RelationEditPicker
          source="series"
          bookUuids={bookUuids}
          membership={membershipFromBooks(books, "series")}
          enabled
          searchPlaceholder={t.plain("search")}
          onCreate={(name) => {
            setCreateSeriesName(name)
            setCreateSeriesOpen(true)
          }}
          createLabel={() => t.plain("newSeries")}
        />
      ),
    })

    entries.push({
      key: "tags",
      label: t.plain("editTags"),
      icon: <ITag.add className="size-4" />,
      submenu: () => (
        <RelationEditPicker
          source="tags"
          bookUuids={bookUuids}
          membership={membershipFromBooks(books, "tags")}
          enabled
          searchPlaceholder={t.plain("search")}
          onCreate={(name) => {
            setCreateTagName(name)
            setCreateTagOpen(true)
          }}
          createLabel={() => t.plain("newTag")}
        />
      ),
    })
  }

  entries.push({
    key: "statuses",
    label: t.plain("setStatus"),
    icon: <icon.BookAlt className="size-4" />,
    submenu: () => (
      <RelationEditPicker
        source="statuses"
        bookUuids={bookUuids}
        membership={membershipFromBooks(books, "statuses")}
        enabled
        searchPlaceholder={t.plain("search")}
      />
    ),
  })

  if (canUpdate && epubBooks.length > 0) {
    entries.push({
      key: "upgradeEpub",
      label: t.plain("upgradeEpub"),
      icon: <icon.Replace className="size-4" />,
      onSelect: () => {
        upgradeAction.confirm()
      },
    })
  }

  if (canProcess) {
    const singleBook = mode === "single" ? books[0] : undefined
    // to process a book we need both source formats present (backend rejects
    // otherwise), or an existing readaloud to continue/re-sync.
    const hasProcessable =
      mode === "bulk"
        ? books.some((b) => b.audiobook || b.ebook)
        : !!singleBook &&
          ((!!singleBook.ebook &&
            !singleBook.ebook.missing &&
            !!singleBook.audiobook &&
            !singleBook.audiobook.missing) ||
            !!singleBook.readaloud)

    if (hasProcessable) {
      if (mode === "single") {
        entries.push({
          key: "processing",
          separatorBefore: true,
          label: tp.plain("menuTitle"),
          icon: <icon.Progress className="size-4" />,
          submenu: ({ close }) => (
            <div className="flex flex-col">
              {processingRun.positions.map((position) => (
                <button
                  key={position.key}
                  type="button"
                  disabled={position.disabled}
                  onClick={() => {
                    processingRun.start(position.restart)
                    close()
                  }}
                  className={actionRowClassName}
                >
                  {position.icon}
                  {tp(position.labelKey)}
                </button>
              ))}
            </div>
          ),
        })
      } else {
        entries.push({
          key: "process",
          separatorBefore: true,
          label: c.plain("states.processing"),
          icon: <icon.Progress className="size-4" />,
          onSelect: () => {
            processAction.confirm()
          },
        })
      }

      entries.push({
        key: "clearCache",
        label: t.plain("clearCache"),
        icon: <icon.Refresh className="size-4" />,
        onSelect: () => {
          clearCacheAction.confirm()
        },
      })
    }
  }

  if (canProcess) {
    entries.push({
      key: "scan",
      label: c.plain("actions.scan"),
      icon: <icon.Scan className="size-4" />,
      onSelect: handleScan,
    })
  }

  if (canDelete) {
    entries.push({
      key: "delete",
      separatorBefore: true,
      variant: "destructive",
      disabled: deleteAction.isLoading,
      label: deleteAction.isLoading
        ? c.plain("states.deleting")
        : c.plain("actions.delete"),
      icon: <icon.Trash className="size-4" />,
      onSelect: () => {
        deleteAction.confirm()
      },
    })
  }

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

  return { entries, dialogs }
}
