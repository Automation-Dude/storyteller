"use client"

import { type UUID } from "crypto"

import {
  IconArrowLeft,
  IconCheck,
  IconFolder,
  IconTag,
  IconX,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

import { BookActionsMenu } from "@v3/_/components/books/BookActionsMenu"
import { BookDetailsSkeleton } from "@v3/_/components/books/BookDetailsSkeleton"
import { CollectionEditor } from "@v3/_/components/books/CollectionEditor"
import { TagEditor } from "@v3/_/components/books/TagEditor"
import { SiteHeader } from "@v3/_/components/site-header"
import { ActionBar } from "@v3/_/components/ui/action-bar"
import { Button } from "@v3/_/components/ui/button"
import { Checkbox } from "@v3/_/components/ui/checkbox"
import { useOptionalBookSelection } from "@v3/_/hooks/use-book-selection"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { cn } from "@/cn"
import { type BookWithRelations } from "@/database/books"
import { usePermissions } from "@/hooks/usePermissions"
import { api, useGetBookQuery } from "@/store/api"
import { useAppDispatch } from "@/store/appState"

import { BookFormProvider, useBookForm } from "./BookDetails/BookFormProvider"
import { DeleteBookModal } from "./BookDetails/DeleteBookModal"
import { TranscriptionStatus } from "./BookDetails/TranscriptionStatus"
import { ContributorsSection } from "./BookDetails/sections/ContributorsSection"
import { DescriptionSection } from "./BookDetails/sections/DescriptionSection"
import { DetailsSection } from "./BookDetails/sections/DetailsSection"
import { DownloadsSection } from "./BookDetails/sections/DownloadsSection"
import { FileSection } from "./BookDetails/sections/FileSection"
import { HeroSection } from "./BookDetails/sections/HeroSection"
import { ReviewSection } from "./BookDetails/sections/ReviewSection"
import {
  ensureContrast,
  useColorPreferences,
  useCoverColors,
  useIsDarkMode,
} from "./BookDetails/sections/useCoverColors"

type BookDetailsContentProps = {
  uuid: UUID
  initialBook?: BookWithRelations
  compact?: boolean
  assetsDir?: string
  isEditing?: boolean
  onEditingChange?: (isEditing: boolean) => void
  onClose?: () => void
}

// seed the getBook cache from a row we already have (e.g. the list query) so
// opening the panel resolves from cache instead of firing another request.
// rtk's equivalent of react-query's initialData.
function useSeedBook(uuid: UUID, book: BookWithRelations | undefined) {
  const dispatch = useAppDispatch()
  const seeded = useRef<string | null>(null)
  if (book && seeded.current !== uuid) {
    seeded.current = uuid
    void dispatch(api.util.upsertQueryData("getBook", { uuid }, book))
  }
}

export function BookDetailsContent({
  uuid,
  initialBook,
  compact,
  assetsDir,
  isEditing,
  onEditingChange,
  onClose,
}: BookDetailsContentProps) {
  useSeedBook(uuid, initialBook)

  const { data: queryBook, isLoading: isLoadingBook } = useGetBookQuery({
    uuid,
  })
  const t = useTranslation("BookDetailsPage")

  const book = queryBook ?? initialBook

  if (isLoadingBook && !initialBook) {
    if (compact) {
      return (
        <div className="flex-1">
          <BookDetailsSkeleton compact={compact} />
        </div>
      )
    }

    return <BookDetailsSkeleton />
  }

  if (!book) {
    if (compact) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <h1 className="text-lg font-bold">{t("bookNotFound")}</h1>
        </div>
      )
    }

    return (
      <div className="flex flex-1 flex-col">
        <SiteHeader
          breadcrumbs={[
            { label: "Books", url: "/books" },
            { label: "Not Found" },
          ]}
        />
        <div className="flex-1 flex-col items-center justify-center">
          <h1 className="text-2xl font-bold">{t("bookNotFound")}</h1>
        </div>
      </div>
    )
  }

  return (
    <BookDetailsContentInner
      book={book}
      compact={compact ?? false}
      assetsDir={assetsDir}
      isEditing={isEditing}
      onEditingChange={onEditingChange}
      onClose={onClose}
    />
  )
}

function BookDetailsContentInner({
  book,
  compact,
  assetsDir,
  isEditing: controlledIsEditing,
  onEditingChange,
  onClose,
}: {
  book: BookWithRelations
  compact: boolean
  assetsDir: string | undefined
  isEditing: boolean | undefined
  onEditingChange: ((isEditing: boolean) => void) | undefined
  onClose: (() => void) | undefined
}) {
  const permissions = usePermissions()
  const [localIsEditing, setLocalIsEditing] = useState(false)

  const isControlled = controlledIsEditing !== undefined
  const isEditing = isControlled ? controlledIsEditing : localIsEditing

  const handleEditingChange = useCallback(
    (value: boolean) => {
      if (isControlled) {
        onEditingChange?.(value)
      } else {
        setLocalIsEditing(value)
      }
    },
    [isControlled, onEditingChange],
  )

  const { primary, accent } = useCoverColors(book)
  const { showAccent } = useColorPreferences()
  const isDark = useIsDarkMode()

  // cover-derived primary/accent only at "full"; otherwise the theme colors
  // (incl. a custom accent color) stay in place. nudged for contrast against the
  // active surface so buttons/accents stay legible in both light and dark mode.
  const cPrimary = ensureContrast(primary, isDark)
  const cAccent = ensureContrast(accent, isDark)
  const colorVars = showAccent
    ? ({
        "--primary": cPrimary.solid,
        "--primary-foreground": cPrimary.onColor,
        "--accent": cAccent.solid,
        "--accent-foreground": cAccent.onColor,
      } as React.CSSProperties)
    : undefined

  return (
    <BookFormProvider
      book={book}
      isEditing={isEditing}
      onEditingChange={handleEditingChange}
    >
      <article
        className="scroll-y bg-background relative flex h-full flex-1 flex-col"
        style={colorVars}
      >
        {!compact && <BookPageHeader />}
        {compact && <BookPanelHeader onClose={onClose} />}
        <BookEditBar />

        <div className="@container-size @container/book flex-1 overflow-y-auto">
          <div
            className={cn(
              "flex flex-col gap-4",
              !compact && "mx-auto max-w-5xl",
            )}
          >
            <HeroSection compact={compact || false} />

            <div className="flex flex-col gap-5 p-6">
              <DescriptionSection />

              <ReviewSection />

              <TranscriptionStatus book={book} />

              <div className="flex w-full flex-col gap-4 @xl/book:grid @xl/book:grid-cols-2 @xl/book:gap-10">
                <TagsSection />
                <CollectionsSection />
              </div>

              <ContributorsSection />

              {permissions?.bookDownload && <DownloadsSection />}

              <DetailsSection />

              <FileSection book={book} assetsDir={assetsDir} />
            </div>

            {permissions?.bookDelete && <DeleteBookModal book={book} />}
          </div>
        </div>
      </article>
    </BookFormProvider>
  )
}

// the colored header for the full book page. mirrors the panel header's tint
// but, per the page, swaps breadcrumbs for a back button and shows the title.
function BookPageHeader() {
  const { book, isEditing, setIsEditing } = useBookForm()
  const { primary } = useCoverColors(book)
  const { showTint, showAccent, tint } = useColorPreferences()
  const router = useRouter()

  return (
    <div
      className="flex h-(--header-height) shrink-0 items-center justify-between gap-2 border-b px-4"
      style={{
        backgroundColor: showTint ? tint(primary, 0.5) : undefined,
        color: showAccent ? primary.onColor : undefined,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            router.back()
          }}
        >
          <IconArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
      </div>

      <BookActionsMenu
        book={book}
        onEdit={() => {
          setIsEditing(!isEditing)
        }}
        onDeleted={() => {
          router.back()
        }}
      />
    </div>
  )
}

// the single edit bar, shared by global edit, single-field inline edit, and
// cover edit. it always offers both Discard and Save (covers used to be the
// only mode with an explicit Save). uses onMouseDown so a click commits/cancels
// before an active field's blur handler fires.
function BookEditBar() {
  const {
    isEditing,
    isSaving,
    editingField,
    editingCovers,
    setIsEditing,
    setEditingCovers,
    submitForm,
    commitField,
    discard,
    discardCovers,
  } = useBookForm()
  const t = useTranslation("BookDetailsPage")

  const show = isEditing || editingField !== null || editingCovers

  const handleDiscard = () => {
    if (editingCovers) {
      discardCovers()
    } else {
      discard()
    }
  }

  const handleSave = async () => {
    if (editingField !== null) {
      const ok = await commitField(editingField)
      if (!ok) toast.error(t("saveFailed"))
      return
    }

    const ok = await submitForm()
    if (ok) {
      setIsEditing(false)
      setEditingCovers(false)
      return
    }

    toast.error(t("saveFailed"))
  }

  return (
    <ActionBar
      show={show}
      className="absolute bottom-4 left-1/2 -translate-x-1/2"
    >
      <span className="text-muted-foreground px-2 text-xs">
        {isSaving ? t("saving") : t("editing")}
      </span>

      <Button
        size="sm"
        variant="ghost"
        onMouseDown={(e) => {
          e.preventDefault()
          handleDiscard()
        }}
        disabled={isSaving}
      >
        <IconX className="mr-1 h-4 w-4" />
        {t("discard")}
      </Button>

      <Button
        size="sm"
        onMouseDown={(e) => {
          e.preventDefault()
          void handleSave()
        }}
        disabled={isSaving}
      >
        <IconCheck className="mr-1 h-4 w-4" />
        {isSaving ? t("saving") : t("save")}
      </Button>
    </ActionBar>
  )
}

// the colored action bar at the top of the panel / drawer. lives with the
// content (rather than the layout) so it reads the book it already loaded and
// needs no separate fetch.
function BookPanelHeader({ onClose }: { onClose: (() => void) | undefined }) {
  const { book, isEditing, setIsEditing } = useBookForm()
  const { primary, accent } = useCoverColors(book)
  const { showTint, showAccent, tint } = useColorPreferences()
  const isDark = useIsDarkMode()
  const cAccent = ensureContrast(accent, isDark)

  const selection = useOptionalBookSelection()
  const isSelected = selection?.isSelected(book.uuid) ?? false

  const handleToggleSelection = () => {
    if (!selection) return
    if (!selection.isSelecting) selection.startSelecting()
    selection.toggleSelection(book.uuid)
  }

  return (
    <div
      className="flex h-10 items-center justify-between border-b px-4 py-2"
      style={{
        backgroundColor: showTint ? tint(primary, 0.5) : undefined,
        color: showAccent ? primary.onColor : undefined,
        ...(isSelected && {
          borderColor: showAccent ? cAccent.solid : "var(--primary)",
        }),
      }}
    >
      <div className="flex items-center gap-3">
        {selection && (
          <Checkbox
            aria-label="Toggle selection"
            checked={isSelected}
            style={
              isSelected && showAccent
                ? {
                    background: cAccent.solid,
                    color: cAccent.onColor,
                    borderColor: cAccent.solid,
                  }
                : undefined
            }
            onCheckedChange={handleToggleSelection}
            className="h-5 w-5"
          />
        )}
      </div>

      <div className="flex items-center gap-1">
        <BookActionsMenu
          book={book}
          showOpenFullPage
          onEdit={() => {
            setIsEditing(!isEditing)
          }}
          onDeleted={onClose}
        />

        {onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <IconX className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

function TagsSection() {
  const { book, isEditing } = useBookForm()
  const tLabels = useTranslation("Labels")

  return (
    <section>
      <h2 className="section-label mb-3">
        <IconTag className="h-4 w-4" />
        {tLabels("tags")}
      </h2>

      <TagEditor
        bookUuid={book.uuid}
        tags={book.tags.map((t) => ({ uuid: t.uuid, name: t.name }))}
        onUpdate={() => {}}
        editMode={isEditing}
      />
    </section>
  )
}

function CollectionsSection() {
  const { book, isEditing } = useBookForm()
  const tLabels = useTranslation("Labels")

  return (
    <section>
      <h2 className="section-label mb-3">
        <IconFolder className="h-4 w-4" />
        {tLabels("collections")}
      </h2>

      <CollectionEditor
        bookUuid={book.uuid}
        collections={book.collections.map((c) => ({
          uuid: c.uuid,
          name: c.name,
        }))}
        onUpdate={() => {}}
        editMode={isEditing}
      />
    </section>
  )
}
