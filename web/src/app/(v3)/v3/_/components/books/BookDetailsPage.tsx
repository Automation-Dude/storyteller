"use client"

import { type UUID } from "crypto"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  IconBook,
  IconCheck,
  IconDownload,
  IconEdit,
  IconFolder,
  IconHeadphones,
  IconPlus,
  IconTag,
  IconUser,
  IconX,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { cn } from "@/cn"
import {
  type Role,
  creatorRelators,
} from "@/components/books/edit/marcRelators"
import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { type BookWithRelations } from "@/database/books"
import {
  getDownloadUrl,
  useCancelProcessingMutation,
  useGetBookQuery,
  useProcessBookMutation,
  useUpdateBookMutation,
} from "@/store/api"

import { BookDetailsSkeleton } from "@v3/_/components/books/BookDetailsSkeleton"
import { CollectionEditor } from "@v3/_/components/books/CollectionEditor"
import { TagEditor } from "@v3/_/components/books/TagEditor"
import { SiteHeader } from "@v3/_/components/site-header"
import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import { Input } from "@v3/_/components/ui/input"
import { Label } from "@v3/_/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v3/_/components/ui/select"
import { Separator } from "@v3/_/components/ui/separator"
import { Textarea } from "@v3/_/components/ui/textarea"
import { V3Link } from "@v3/_/components/v3-link"

import { DeleteBookModal } from "./BookDetails/DeleteBookModal"
import { DetailsSection } from "./BookDetails/DetailsSection"
import { FileSection } from "./BookDetails/FileSection"
import { HeroSection } from "./BookDetails/HeroSection"
import { TranscriptionStatus } from "./BookDetails/TranscriptionStatus"
import { type BookFormValues, bookFormSchema } from "./BookDetails/schema"

type EditableCreator = {
  name: string
  role: string
}

type BookDetailsContentProps = {
  uuid: UUID
  initialBook?: BookWithRelations
  compact?: boolean
  canEdit?: boolean
  canDownload?: boolean
  canDelete?: boolean
}

export function BookDetailsContent({
  uuid,
  initialBook,
  compact,
  canEdit,
  canDownload,
  canDelete,
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
    />
  )
}

function BookDetailsContentInner({
  book,
  compact,
  canEdit,
  canDownload,
  canDelete,
  isEditing: controlledIsEditing,
  onEditingChange,
}: Omit<BookDetailsContentProps, "uuid" | "initialBook"> & {
  book: BookWithRelations
}) {
  const [updateBook, { isLoading: isSaving }] = useUpdateBookMutation()
  const [processBook] = useProcessBookMutation()
  const [cancelProcessing] = useCancelProcessingMutation()
  const [localIsEditing, setLocalIsEditing] = useState(false)
  const tLabels = useTranslations("Labels")
  const t = useTranslations("BookDetailsPage")

  const isControlled = controlledIsEditing !== undefined
  const isEditing = isControlled ? controlledIsEditing : localIsEditing

  const setIsEditing = useCallback(
    (value: boolean) => {
      if (isControlled) {
        onEditingChange?.(value)
      } else {
        setLocalIsEditing(value)
      }
    },
    [isControlled, onEditingChange],
  )

  const [editAuthors, setEditAuthors] = useState<string[]>([])
  const [editNarrators, setEditNarrators] = useState<string[]>([])
  const [editCreators, setEditCreators] = useState<EditableCreator[]>([])

  const form = useForm<BookFormValues>({
    resolver: zodResolver(bookFormSchema),
  })

  useEffect(() => {
    form.reset({
      title: book.title,
      subtitle: book.subtitle,
      description: book.description,
      language: book.language,
      publicationDate: book.publicationDate,
    })
  }, [book, form])

  // useEffect(() => {
  //   if (!book || !isEditing) {
  //     return
  //   }

  //   setEditAuthors(book.authors.map((a) => a.name))
  //   setEditNarrators(book.narrators.map((n) => n.name))
  //   setEditCreators(
  //     book.creators
  //       .filter((c) => c.role !== "aut" && c.role !== "nrt")
  //       .map((c): EditableCreator => ({ name: c.name, role: c.role ?? "" })),
  //   )
  //   setTextCoverFile(null)
  //   setAudioCoverFile(null)
  //   setTextCoverPreview(null)
  // }, [isEditing, book])

  const handleSave = useCallback(
    async (values: BookFormValues) => {
      await updateBook({
        update: {
          uuid,
          title: values.title,
          subtitle: values.subtitle,
          description: values.description,
          language: values.language,
          publicationDate: values.publicationDate,
          authors: editAuthors,
          narrators: editNarrators,
          creators: editCreators
            .filter((c) => c.name.trim())
            .map((c) => ({
              name: c.name,
              fileAs: c.name,
              role: (c.role || "oth") as Role,
            })),
        },
        textCover: textCoverFile,
        audioCover: audioCoverFile,
      })
      setIsEditing(false)
    },
    [
      uuid,
      updateBook,
      editAuthors,
      editNarrators,
      editCreators,
      textCoverFile,
      audioCoverFile,
      setIsEditing,
    ],
  )

  const handleCancel = () => {
    if (!book) {
      setIsEditing(false)
      return
    }

    form.reset({
      title: book.title,
      subtitle: book.subtitle,
      description: book.description,
      language: book.language,
      publicationDate: book.publicationDate,
    })

    setEditAuthors(book.authors.map((a) => a.name))
    setEditNarrators(book.narrators.map((n) => n.name))
    setEditCreators(
      book.creators
        .filter((c) => c.role !== "aut" && c.role !== "nrt")
        .map((c): EditableCreator => ({ name: c.name, role: c.role ?? "" })),
    )
    setTextCoverFile(null)
    setAudioCoverFile(null)
    setTextCoverPreview(null)
    setIsEditing(false)
  }

  return (
    <article className="relative flex h-full flex-1 flex-col overflow-y-auto">
      {!compact && (
        <SiteHeader
          breadcrumbs={[
            { label: "Books", url: "/books" },
            { label: book.title },
          ]}
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
                    onClick={form.handleSubmit(handleSave)}
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
      )}

      {compact && isEditing && (
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

          <Button
            size="sm"
            onClick={form.handleSubmit(handleSave)}
            disabled={isSaving}
          >
            <IconCheck className="mr-1 h-4 w-4" />
            {isSaving ? t("saving") : t("save")}
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className={cn("p-6", !compact && "mx-auto max-w-5xl")}>
          <HeroSection
            book={book}
            isEditing={isEditing}
            form={form}
            compact={compact}
          />

          <Separator className="my-8" />

          <section className="mb-8">
            {isEditing ? (
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="description"
                  className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase"
                >
                  {tLabels("description")}
                </Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  className="min-h-32 resize-y"
                />
              </div>
            ) : book.description ? (
              <div>
                <h2 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  {tLabels("description")}
                </h2>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: book.description }}
                />
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                {t("noDescriptionAvailable")}
              </p>
            )}
          </section>

          <TranscriptionStatus
            book={book}
            onProcess={() => void processBook({ uuid: book.uuid })}
            onCancel={() => void cancelProcessing({ uuid: book.uuid })}
          />

          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <IconTag className="h-4 w-4" />
              {tLabels("tags")}
            </h2>
            <TagEditor
              bookUuid={book.uuid}
              tags={book.tags.map((t) => ({
                uuid: t.uuid,
                name: t.name,
              }))}
              onUpdate={() => {
                // TODO: refetch
              }}
              editMode={isEditing}
            />
          </section>

          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <IconFolder className="h-4 w-4" />
              {tLabels("collections")}
            </h2>
            <CollectionEditor
              bookUuid={book.uuid}
              collections={book.collections.map((c) => ({
                uuid: c.uuid,
                name: c.name,
              }))}
              onUpdate={() => {
                // TODO: refetch
              }}
              editMode={isEditing}
            />
          </section>

          <Separator className="my-8" />

          {(isEditing ||
            book.creators.filter((c) => c.role !== "aut" && c.role !== "nrt")
              .length > 0) && (
            <section className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <IconUser className="h-4 w-4" />
                {tLabels("otherContributors")}
              </h2>

              {isEditing ? (
                <div className="flex flex-col gap-3">
                  {editCreators.map((creator, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={creator.name}
                        onChange={(e) => {
                          setEditCreators((prev) =>
                            prev.map((c, i) =>
                              i === idx ? { ...c, name: e.target.value } : c,
                            ),
                          )
                        }}
                        placeholder="Name"
                        className="h-8 flex-1 text-sm"
                      />

                      <Select
                        value={creator.role}
                        onValueChange={(value) => {
                          setEditCreators((prev) =>
                            prev.map(
                              (c, i): EditableCreator =>
                                i === idx ? { ...c, role: value ?? "" } : c,
                            ),
                          )
                        }}
                      >
                        <SelectTrigger className="h-8 w-48 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {creatorRelators.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditCreators((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }}
                      >
                        <IconX className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => {
                      setEditCreators((prev) => [
                        ...prev,
                        { name: "", role: "" },
                      ])
                    }}
                  >
                    <IconPlus className="mr-1 h-3 w-3" />
                    Add contributor
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {book.creators
                    .filter((c) => c.role !== "aut" && c.role !== "nrt")
                    .map((creator) => (
                      <Badge key={creator.uuid} variant="outline">
                        {creator.name}
                        {creator.role && (
                          <span className="text-muted-foreground ml-1">
                            ({creator.role})
                          </span>
                        )}
                      </Badge>
                    ))}
                </div>
              )}
            </section>
          )}

          {canDownload && (
            <>
              <Separator className="my-8" />
              <section className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-medium">
                  <IconDownload className="h-4 w-4" />
                  {tLabels("downloads")}
                </h2>
                <div className="flex flex-wrap gap-3">
                  {book.readaloud?.filepath && (
                    <Button
                      variant="outline"
                      nativeButton={false}
                      render={
                        <V3Link href={getDownloadUrl(book.uuid, "readaloud")}>
                          <IconReadaloud className="text-st-orange-500 mr-2 h-4 w-4" />
                          {t("downloads.downloadReadaloud")}
                        </V3Link>
                      }
                    />
                  )}
                  {book.ebook && (
                    <Button
                      nativeButton={false}
                      variant="outline"
                      render={
                        <V3Link href={getDownloadUrl(book.uuid, "ebook")}>
                          <IconBook className="mr-2 h-4 w-4" />
                          {t("downloads.downloadEbook")}
                        </V3Link>
                      }
                    />
                  )}
                  {book.audiobook && (
                    <Button
                      nativeButton={false}
                      variant="outline"
                      render={
                        <V3Link href={getDownloadUrl(book.uuid, "audiobook")}>
                          <IconHeadphones className="mr-2 h-4 w-4" />
                          {t("downloads.downloadAudiobook")}
                        </V3Link>
                      }
                    />
                  )}
                </div>
              </section>
            </>
          )}

          <DetailsSection book={book} isEditing={isEditing} form={form} />
          <Separator className="my-8" />
          <FileSection book={book} />
        </div>
      </div>
      {canDelete && <DeleteBookModal book={book} canDelete={canDelete} />}
    </article>
  )
}
