"use client"

import { type UUID } from "crypto"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  IconBook,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconDownload,
  IconEdit,
  IconFileText,
  IconFolder,
  IconHeadphones,
  IconLanguage,
  IconTag,
  IconUser,
  IconX,
} from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { Fragment, useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/app/(v3)/v3/_/components/ui/dialog"
import { cn } from "@/cn"
import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { type BookWithRelations } from "@/database/books"
import {
  getDownloadUrl,
  useGetBookQuery,
  useListStatusesQuery,
  useUpdateBookMutation,
  useUpdateStatusMutation,
} from "@/store/api"

import { BookCover } from "@v3/_/components/books/BookCover"
import { BookDetailsSkeleton } from "@v3/_/components/books/BookDetailsSkeleton"
import { CollectionEditor } from "@v3/_/components/books/CollectionEditor"
import { RatingInput } from "@v3/_/components/books/RatingInput"
import { SeriesEditor } from "@v3/_/components/books/SeriesEditor"
import { TagEditor } from "@v3/_/components/books/TagEditor"
import { SiteHeader } from "@v3/_/components/site-header"
import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { Input } from "@v3/_/components/ui/input"
import { Label } from "@v3/_/components/ui/label"
import { Separator } from "@v3/_/components/ui/separator"
import { Textarea } from "@v3/_/components/ui/textarea"
import { V3Link } from "@v3/_/components/v3-link"

const bookFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().nullable(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  publicationDate: z.string().nullable(),
})

type BookFormValues = z.infer<typeof bookFormSchema>

function formatDate(dateString: string | null): string {
  if (!dateString) return ""
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } catch {
    return dateString
  }
}

function formatYear(dateString: string | null): string {
  if (!dateString) return ""
  try {
    return new Date(dateString).getFullYear().toString()
  } catch {
    return ""
  }
}

function ReadingStatusButton({
  book,
  canEdit,
  onStatusChange,
}: {
  book: BookWithRelations
  canEdit: boolean
  onStatusChange?: () => void
}) {
  const { data: statuses = [] } = useListStatusesQuery()
  const [updateStatus] = useUpdateStatusMutation()

  const currentStatus = book.status

  const handleStatusChange = useCallback(
    async (statusUuid: string) => {
      await updateStatus({
        bookUuid: book.uuid,
        statusUuid:
          statusUuid as `${string}-${string}-${string}-${string}-${string}`,
      })
      onStatusChange?.()
    },
    [book.uuid, updateStatus, onStatusChange],
  )

  if (!canEdit) {
    return currentStatus ? (
      <Badge variant="secondary" className="text-sm">
        {currentStatus.name}
      </Badge>
    ) : null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "gap-2",
              currentStatus && "border-primary bg-primary/5 text-primary",
            )}
          >
            <IconBook className="h-4 w-4" />
            {currentStatus?.name ?? "Set Status"}
            <IconChevronDown className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {statuses.map((status) => (
          <DropdownMenuItem
            key={status.uuid}
            onClick={() => handleStatusChange(status.uuid)}
            className={cn(
              String(currentStatus?.uuid) === status.uuid && "bg-accent",
            )}
          >
            {status.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FormatBadges({ book }: { book: BookWithRelations }) {
  const hasEbook = book.ebook !== null
  const hasAudiobook = book.audiobook !== null
  const isSynced =
    book.readaloud !== null && book.readaloud.status === "ALIGNED"

  return (
    <div className="flex flex-wrap gap-2">
      {isSynced && (
        <Badge className="gap-1 bg-orange-500 text-white hover:bg-orange-600">
          <IconReadaloud className="size-6" />
          ReadAloud
        </Badge>
      )}
      {hasEbook && (
        <Badge variant="secondary" className="gap-1">
          <IconBook className="h-3 w-3" />
          Ebook
        </Badge>
      )}
      {hasAudiobook && (
        <Badge variant="secondary" className="gap-1">
          <IconHeadphones className="h-3 w-3" />
          Audiobook
        </Badge>
      )}
    </div>
  )
}

function MetadataRow({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
  className?: string
}) {
  if (!children) return null

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </span>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

export function BookDetailsContent({
  uuid,
  compact = false,
}: {
  uuid: UUID
  compact?: boolean
}) {
  const { data: book, isLoading: isLoadingBook } = useGetBookQuery({
    uuid,
  })
  const [updateBook, { isLoading: isSaving }] = useUpdateBookMutation()
  const [isEditing, setIsEditing] = useState(false)
  const tLabels = useTranslations("Labels")
  const t = useTranslations("BookDetailsPage")

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare
  const canEdit = true === true
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare
  const canDownload = true === true

  const form = useForm<BookFormValues>({
    resolver: zodResolver(bookFormSchema),
    // defaultValues: {
    //   title: book.title,
    //   subtitle: book.subtitle,
    //   description: book.description,
    //   language: book.language,
    //   publicationDate: book.publicationDate,
    // },
  })

  useEffect(() => {
    if (!book) {
      return
    }
    form.reset({
      title: book.title,
      subtitle: book.subtitle,
      description: book.description,
      language: book.language,
      publicationDate: book.publicationDate,
    })
  }, [book, form])

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
        },
      })
      setIsEditing(false)
    },
    [uuid, updateBook],
  )

  const handleRatingChange = async (rating: number | null) => {
    await updateBook({
      update: {
        uuid,
        rating,
      },
    })
  }

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
    setIsEditing(false)
  }

  if (isLoadingBook) {
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

  const authors = book.authors
  const narrators = book.narrators

  return (
    <div className="flex flex-1 flex-col">
      {!compact && (
        <SiteHeader
          breadcrumbs={[
            { label: "Books", url: "/books" },
            { label: book.title },
          ]}
          actions={
            canEdit &&
            !compact && [
              isEditing ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    <IconX className="h-4 w-4" />
                  </Button>
                  <Button
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

      <div className="flex-1 overflow-y-auto">
        <div className={cn("p-6", !compact && "mx-auto max-w-5xl")}>
          <div
            className={cn(
              "flex gap-8",
              compact ? "flex-col" : "flex-col md:flex-row",
            )}
          >
            <div
              className={cn(
                "flex h-80 w-52 items-center justify-center",
                compact ? "mx-auto" : "",
              )}
            >
              <Dialog>
                <DialogTrigger
                  className={cn(
                    "flex shrink-0 cursor-zoom-in flex-col items-center justify-center rounded-lg",
                    compact
                      ? "mx-auto h-80 w-60"
                      : "flex w-[clamp(140px,25vw,200px)] justify-center md:justify-start",
                  )}
                >
                  <BookCover
                    book={book}
                    width={compact ? 176 : 200}
                    key={book.uuid}
                  />
                </DialogTrigger>

                <DialogContent className="p-0">
                  <BookCover
                    book={book}
                    width={compact ? 176 : 200}
                    key={book.uuid}
                  />
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex flex-1 flex-col">
              <div className="flex items-start justify-between gap-4">
                {isEditing ? (
                  <div className="flex flex-1 flex-col gap-3">
                    <div>
                      <Label htmlFor="title">{tLabels("title")}</Label>
                      <Input
                        id="title"
                        {...form.register("title")}
                        className="mt-1 text-2xl font-semibold"
                      />
                    </div>
                    <div>
                      <Label htmlFor="subtitle">{tLabels("subtitle")}</Label>
                      <Input
                        id="subtitle"
                        {...form.register("subtitle")}
                        className="mt-1"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    <h1 className="font-heading text-xl font-semibold">
                      {book.title}
                    </h1>
                    {book.subtitle && (
                      <p className="text-muted-foreground mt-1 text-lg">
                        {book.subtitle}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {authors.length > 0 && (
                <p className="text-muted-foreground mt-3 flex flex-wrap items-center gap-1 text-sm">
                  <span>{t("writtenBy")}</span>
                  {authors.map((author, idx) => (
                    <Fragment key={author.uuid}>
                      <V3Link
                        href={`/books?author=${author.uuid}`}
                        className="hover:text-primary text-foreground line-clamp-1 inline font-medium break-all hyphens-auto hover:underline"
                      >
                        {author.name}
                      </V3Link>
                      <span>{idx < authors.length - 1 && ", "}</span>
                    </Fragment>
                  ))}
                </p>
              )}

              {narrators.length > 0 && (
                <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                  <span>{t("narratedBy")}</span>
                  {narrators.map((narrator, idx) => (
                    <span key={narrator.uuid}>
                      <span className="text-foreground">{narrator.name}</span>
                      {idx < narrators.length - 1 && ", "}
                    </span>
                  ))}
                </div>
              )}

              {/* rating - interactive */}
              <div className="mt-3">
                <RatingInput
                  value={book.rating}
                  onChange={handleRatingChange}
                  readOnly={!canEdit}
                />
              </div>

              <div className="mt-4">
                <SeriesEditor
                  bookUuid={book.uuid}
                  series={book.series.map((s) => ({
                    uuid: s.uuid,
                    name: s.name,
                    position: s.position,
                    featured: s.featured,
                  }))}
                  onUpdate={() => {
                    // TODO: refetch
                  }}
                  editMode={isEditing}
                />
              </div>

              <div className="flex-1" />

              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <div className="flex flex-wrap items-center gap-4">
                  {book.publicationDate && !isEditing && (
                    <span className="text-muted-foreground text-sm">
                      {formatYear(book.publicationDate)}
                    </span>
                  )}
                  <FormatBadges book={book} />
                </div>
                <ReadingStatusButton book={book} canEdit={canDownload} />
              </div>
            </div>
          </div>

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

          {/* metadata grid */}
          <section className="mb-8">
            <h2 className="mb-4 text-sm font-medium">
              {tLabels("bookDetails")}
            </h2>
            <div className="flex flex-wrap gap-4">
              {isEditing ? (
                <>
                  <div>
                    <Label htmlFor="language">{tLabels("language")}</Label>
                    <Input
                      id="language"
                      {...form.register("language")}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="publicationDate">
                      {tLabels("publicationDate")}
                    </Label>
                    <Input
                      id="publicationDate"
                      type="date"
                      {...form.register("publicationDate")}
                      className="mt-1"
                    />
                  </div>
                </>
              ) : (
                <>
                  <MetadataRow icon={IconLanguage} label={tLabels("language")}>
                    {book.language}
                  </MetadataRow>
                  <MetadataRow
                    icon={IconCalendar}
                    label={tLabels("publicationDate")}
                  >
                    {book.publicationDate && formatDate(book.publicationDate)}
                  </MetadataRow>
                  <MetadataRow icon={IconCalendar} label={tLabels("added")}>
                    {formatDate(book.createdAt)}
                  </MetadataRow>
                  <MetadataRow
                    icon={IconCalendar}
                    label={tLabels("lastUpdated")}
                  >
                    {formatDate(book.updatedAt)}
                  </MetadataRow>
                </>
              )}
            </div>
          </section>

          {/* other creators */}
          {book.creators.filter((c) => c.role !== "aut" && c.role !== "nrt")
            .length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
                <IconUser className="h-4 w-4" />
                {tLabels("otherContributors")}
              </h2>
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
            </section>
          )}

          {/* downloads */}
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

          {/* file info */}
          <Separator className="my-8" />
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-medium">
              <IconFileText className="h-4 w-4" />
              {t("fileInformation.title")}
            </h2>
            <div className="bg-muted/50 space-y-3 rounded-lg p-4">
              {book.readaloud?.filepath && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    {t("fileInformation.readaloud")}
                  </span>
                  <code className="text-sm break-all">
                    {book.readaloud.filepath}
                  </code>
                </div>
              )}
              {book.ebook && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    {t("fileInformation.ebook")}
                  </span>
                  <code className="text-sm break-all">
                    {book.ebook.filepath}
                  </code>
                </div>
              )}
              {book.audiobook && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    {t("fileInformation.audiobook")}
                  </span>
                  <code className="text-sm break-all">
                    {book.audiobook.filepath}
                  </code>
                </div>
              )}
              {book.alignedAt && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    {t("fileInformation.lastAligned")}
                  </span>
                  <span className="text-sm">{formatDate(book.alignedAt)}</span>
                </div>
              )}
              {book.alignedWith && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    {t("fileInformation.transcriptionEngine")}
                  </span>
                  <span className="text-sm">{book.alignedWith}</span>
                </div>
              )}
              {book.alignedByStorytellerVersion && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    {t("fileInformation.storytellerVersion")}
                  </span>
                  <span className="text-sm">
                    {book.alignedByStorytellerVersion}
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
