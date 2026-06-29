"use client"

import { type UUID } from "crypto"

import {
  IconArrowLeft,
  IconCheck,
  IconFolder,
  IconTag,
  IconX,
} from "@tabler/icons-react"
import dynamic from "next/dynamic"
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
import { useReportPanel } from "@v3/_/hooks/use-report-panel"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { cn } from "@/cn"
import { type BookWithRelations } from "@/database/books"
import { usePermissions } from "@/hooks/usePermissions"
import { api, useGetBookQuery } from "@/store/api"
import { useAppDispatch } from "@/store/appState"

import { BookFormProvider, useBookForm } from "./BookDetails/BookFormProvider"
import { DeleteBookModal } from "./BookDetails/DeleteBookModal"
import { TranscriptionStatus } from "./BookDetails/TranscriptionStatus"
import { CollapsibleSection } from "./BookDetails/sections/CollapsibleSection"
import { ContributorsSection } from "./BookDetails/sections/ContributorsSection"
import { DescriptionSection } from "./BookDetails/sections/DescriptionSection"
import { DetailsSection } from "./BookDetails/sections/DetailsSection"
import { FileSection } from "./BookDetails/sections/FileSection"
import { HeroSection } from "./BookDetails/sections/HeroSection"
import { ReviewSection } from "./BookDetails/sections/ReviewSection"
import {
  ensureContrast,
  useColorPreferences,
  useCoverColors,
  useIsDarkMode,
} from "./BookDetails/sections/useCoverColors"
import { TooltipButton } from "../ui/tooltip-button"

// table-heavy report view; lazy so it stays out of the book-details bundle and
// only loads when a book is actually viewed in report mode.
const DynamicAlignmentReport = dynamic(
  () =>
    import(
      "@v3/_/components/books/AlignmentReport/AlignmentReportContent"
    ).then((mod) => mod.AlignmentReportContent),
  { ssr: false },
)

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
  const [reportMode, setReportMode] = useReportPanel()

  // only honor report mode when there is actually a report to show.
  const showReport = reportMode && !!book.alignmentGrade

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
  const { showAccent, tint } = useColorPreferences()
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
        className="bg-background relative h-full w-full"
        style={colorVars}
      >
        {!compact && <BookPageHeader />}
        {compact && <BookPanelHeader onClose={onClose} />}
        <BookEditBar />

        <div className="@container-size scroll-y @container/book h-full flex-1">
          {/* this is some fucked up structure but its necessary in order to get full width background 
        for full page view
         */}
          <HeroSection
            compact={compact || false}
            className={cn(!compact && "mx-auto max-w-5xl")}
          />
          <div
            className={cn(
              "flex flex-col gap-4",
              !compact && "mx-auto max-w-5xl",
            )}
          >
            {showReport ? (
              <DynamicAlignmentReport
                uuid={book.uuid}
                compact
                embedded
                onBack={() => void setReportMode(false)}
              />
            ) : (
              <div className="flex flex-col gap-5 p-6">
                <ReviewSection />

                <DescriptionSection />

                <DetailsSection />

                <div className="flex w-full flex-col gap-4 @xl/book:grid @xl/book:grid-cols-2 @xl/book:gap-10">
                  <TagsSection />
                  <CollectionsSection />
                </div>

                <ContributorsSection />

                {permissions?.bookProcess &&
                  ((!book.ebook?.missing && !book.audiobook?.missing) ||
                    book.readaloud) && <TranscriptionStatus book={book} />}

                <FileSection book={book} assetsDir={assetsDir} />
              </div>
            )}

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
      className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2"
    >
      <span className="text-muted-foreground px-2 text-xs">
        {isSaving ? t("saving") : t("editing")}
      </span>

      <TooltipButton
        tooltip={t("discard")}
        aria-label={t("discard")}
        variant="real-ghost"
        onMouseDown={(e) => {
          e.preventDefault()
          handleDiscard()
        }}
        disabled={isSaving}
      >
        <IconX className="size-4" />
      </TooltipButton>

      <TooltipButton
        tooltip={isSaving ? t("saving") : t("save")}
        aria-label={t("save")}
        onMouseDown={(e) => {
          e.preventDefault()
          void handleSave()
        }}
        className="rounded-full"
        disabled={isSaving}
      >
        <IconCheck className="size-4" />
      </TooltipButton>
    </ActionBar>
  )
}

function BookPanelHeader({ onClose }: { onClose: (() => void) | undefined }) {
  const { book, isEditing, setIsEditing } = useBookForm()
  const { showAccent } = useColorPreferences()
  const { accent } = useCoverColors(book)
  const isDark = useIsDarkMode()
  const cAccent = ensureContrast(accent, isDark)

  const selection = useOptionalBookSelection()
  const isSelected = selection?.isSelected(book.uuid) ?? false
  const showCheckbox = !!selection && (selection.isSelecting || isSelected)

  const handleToggleSelection = () => {
    if (!selection) return
    if (!selection.isSelecting) selection.startSelecting()
    selection.toggleSelection(book.uuid)
  }

  const pill =
    "flex items-center gap-0.5 rounded-full bg-background/55 p-0.5 shadow-sm ring-1 ring-black/5 backdrop-blur-md dark:ring-white/10"

  return (
    <>
      {showCheckbox && (
        <div className={cn("absolute top-3 left-3 z-50 p-1", pill)}>
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
            className="size-5 rounded-full"
          />
        </div>
      )}

      <div className={cn("absolute top-2.5 right-3 z-50", pill)}>
        <BookActionsMenu
          book={book}
          showOpenFullPage
          onEdit={() => {
            setIsEditing(!isEditing)
          }}
          onDeleted={onClose}
        />

        {onClose && (
          <Button variant="real-ghost" size="icon-sm" onClick={onClose}>
            <IconX className="size-3.5 stroke-[1.5]" />
          </Button>
        )}
      </div>
    </>
  )
}

function TagsSection() {
  const { book, isEditing } = useBookForm()
  const tLabels = useTranslation("Labels")

  return (
    <CollapsibleSection
      title={tLabels("tags")}
      icon={<IconTag className="size-3.5 stroke-[1.5]" />}
    >
      <TagEditor
        bookUuid={book.uuid}
        tags={book.tags.map((t) => ({ uuid: t.uuid, name: t.name }))}
        onUpdate={() => {}}
        editMode={isEditing}
      />
    </CollapsibleSection>
  )
}

function CollectionsSection() {
  const { book, isEditing } = useBookForm()
  const tLabels = useTranslation("Labels")

  return (
    <CollapsibleSection
      title={tLabels("collections")}
      icon={<IconFolder className="size-3.5 stroke-[1.5]" />}
    >
      <CollectionEditor
        bookUuid={book.uuid}
        collections={book.collections.map((c) => ({
          uuid: c.uuid,
          name: c.name,
        }))}
        onUpdate={() => {}}
        editMode={isEditing}
      />
    </CollapsibleSection>
  )
}
