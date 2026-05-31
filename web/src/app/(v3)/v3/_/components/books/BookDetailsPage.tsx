"use client"

import { type UUID } from "crypto"

import {
  IconCheck,
  IconEdit,
  IconFolder,
  IconTag,
  IconX,
} from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"

import { BookDetailsSkeleton } from "@v3/_/components/books/BookDetailsSkeleton"
import { CollectionEditor } from "@v3/_/components/books/CollectionEditor"
import { TagEditor } from "@v3/_/components/books/TagEditor"
import { SiteHeader } from "@v3/_/components/site-header"
import { Button } from "@v3/_/components/ui/button"

import { cn } from "@/cn"
import { type BookWithRelations } from "@/database/books"
import { useGetBookQuery } from "@/store/api"

import { BookFormProvider, useBookForm } from "./BookDetails/BookFormProvider"
import { DeleteBookModal } from "./BookDetails/DeleteBookModal"
import { TranscriptionStatus } from "./BookDetails/TranscriptionStatus"
import { ContributorsSection } from "./BookDetails/sections/ContributorsSection"
import { DescriptionSection } from "./BookDetails/sections/DescriptionSection"
import { DetailsSection } from "./BookDetails/sections/DetailsSection"
import { DownloadsSection } from "./BookDetails/sections/DownloadsSection"
import { FileSection } from "./BookDetails/sections/FileSection"
import { HeroSection } from "./BookDetails/sections/HeroSection"

type BookDetailsContentProps = {
  uuid: UUID
  initialBook?: BookWithRelations
  compact?: boolean
  canEdit?: boolean
  canDownload?: boolean
  canDelete?: boolean
  canProcess?: boolean
  assetsDir?: string
  isEditing?: boolean
  onEditingChange?: (isEditing: boolean) => void
}

export function BookDetailsContent({
  uuid,
  initialBook,
  compact,
  canEdit,
  canDownload,
  canDelete,
  canProcess,
  assetsDir,
  isEditing,
  onEditingChange,
}: BookDetailsContentProps) {
  const { data: queryBook, isLoading: isLoadingBook } = useGetBookQuery({
    uuid,
  })
  const t = useTranslations("BookDetailsPage")

  const book = queryBook ?? initialBook

  if (isLoadingBook && !initialBook) {
    if (compact) {
      return (
        <div className="flex flex-1 items-center justify-center">
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
      canEdit={canEdit}
      canDownload={canDownload}
      canDelete={canDelete}
      canProcess={canProcess}
      assetsDir={assetsDir}
      isEditing={isEditing}
      onEditingChange={onEditingChange}
    />
  )
}

function BookDetailsContentInner({
  book,
  compact,
  canEdit,
  canDownload,
  canDelete,
  canProcess,
  assetsDir,
  isEditing: controlledIsEditing,
  onEditingChange,
}: {
  book: BookWithRelations
  compact: boolean
  canEdit: boolean | undefined
  canDownload: boolean | undefined
  canDelete: boolean | undefined
  canProcess: boolean | undefined
  assetsDir: string | undefined
  isEditing: boolean | undefined
  onEditingChange: ((isEditing: boolean) => void) | undefined
}) {
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

  return (
    <BookFormProvider
      book={book}
      isEditing={isEditing}
      onEditingChange={handleEditingChange}
    >
      <article className="scroll-y relative flex h-full flex-1 flex-col">
        {!compact && <BookDetailsHeader canEdit={canEdit} />}
        {compact && <CompactEditBar />}

        <div className="flex-1 overflow-y-auto">
          <div
            className={cn(
              "flex flex-col gap-4",
              !compact && "mx-auto max-w-5xl",
            )}
          >
            <HeroSection compact={compact || false} />

            <div className="flex flex-col gap-5 p-6">
              <DescriptionSection />

              <TranscriptionStatus book={book} canProcess={true} />

              <TagsSection />
              <CollectionsSection />

              <ContributorsSection />

              {canDownload && <DownloadsSection />}

              <DetailsSection />

              <FileSection
                book={book}
                assetsDir={assetsDir}
                canEdit={canEdit}
              />
            </div>

            {canDelete && <DeleteBookModal book={book} />}
          </div>
        </div>
      </article>
    </BookFormProvider>
  )
}

function BookDetailsHeader({ canEdit }: { canEdit: boolean | undefined }) {
  const { book, isEditing, isSaving, setIsEditing, submitForm, form } =
    useBookForm()
  const t = useTranslations("BookDetailsPage")

  const handleCancel = () => {
    form.reset()
    setIsEditing(false)
  }

  const handleSave = async () => {
    const success = await submitForm()
    if (success) setIsEditing(false)
  }

  return (
    <SiteHeader
      breadcrumbs={[{ label: "Books", url: "/books" }, { label: book.title }]}
      actions={
        canEdit && [
          isEditing ? (
            <>
              <Button
                key="cancel"
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <IconX className="h-4 w-4" />
              </Button>

              <Button
                key="save"
                size="sm"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                <IconCheck className="mr-1 h-4 w-4" />
                {isSaving ? t("saving") : t("save")}
              </Button>
            </>
          ) : (
            <Button
              key="edit"
              size="sm"
              onClick={() => {
                setIsEditing(true)
              }}
            >
              <IconEdit className="mr-1 h-4 w-4" />
              {t("edit")}
            </Button>
          ),
        ]
      }
    />
  )
}

function CompactEditBar() {
  const { isEditing, isSaving, setIsEditing, submitForm, form } = useBookForm()
  const t = useTranslations("BookDetailsPage")

  if (!isEditing) return null

  const handleCancel = () => {
    form.reset()
    setIsEditing(false)
  }

  const handleSave = async () => {
    const success = await submitForm()
    if (success) setIsEditing(false)
  }

  return (
    <div className="bg-background sticky top-0 z-10 flex items-center justify-end gap-2 border-b px-4 py-2">
      <Button
        size="sm"
        variant="ghost"
        onClick={handleCancel}
        disabled={isSaving}
      >
        <IconX className="mr-1 h-4 w-4" />
        {t("cancel")}
      </Button>

      <Button size="sm" onClick={() => void handleSave()} disabled={isSaving}>
        <IconCheck className="mr-1 h-4 w-4" />
        {isSaving ? t("saving") : t("save")}
      </Button>
    </div>
  )
}

function TagsSection() {
  const { book, isEditing } = useBookForm()
  const tLabels = useTranslations("Labels")

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
  const tLabels = useTranslations("Labels")

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
