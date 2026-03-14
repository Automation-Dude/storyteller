"use client"

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
  IconRefresh,
  IconTag,
  IconUser,
  IconX,
} from "@tabler/icons-react"
import { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

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
import { UUID } from "crypto"
import BookDetailsSkeleton from "./loading"

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
            onClick={() => handleStatusChange(String(status.uuid))}
            className={cn(
              String(currentStatus?.uuid) === String(status.uuid) &&
                "bg-accent",
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
    book.readaloud !== null && book.readaloud?.status === "ALIGNED"

  return (
    <div className="flex flex-wrap gap-2">
      {isSynced && (
        <Badge className="gap-1 bg-orange-500 text-white hover:bg-orange-600">
          <IconRefresh className="h-3 w-3" />
          Synced
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

export function BookDetailsContent({ uuid }: { uuid: UUID }) {
  const { data: book, isLoading: isLoadingBook } = useGetBookQuery({
    uuid,
  })
  const [updateBook, { isLoading: isSaving }] = useUpdateBookMutation()
  const [isEditing, setIsEditing] = useState(false)

  console.log("book", book)

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
    return <BookDetailsSkeleton />
  }

  if (!book) {
    return (
      <div className="flex flex-1 flex-col">
        <SiteHeader
          breadcrumbs={[
            { label: "Books", url: "/books" },
            { label: "Not Found" },
          ]}
        />
        <div className="flex-1 flex-col items-center justify-center">
          <h1 className="text-2xl font-bold">Book not found</h1>
        </div>
      </div>
    )
  }

  const authors = book.authors
  const narrators = book.narrators

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader
        breadcrumbs={[{ label: "Books", url: "/books" }, { label: book.title }]}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-6">
          {/* main content: cover + info */}
          <div className="flex flex-col gap-8 md:flex-row">
            {/* cover */}
            <div className="flex h-80 w-[clamp(140px,25vw,200px)] shrink-0 justify-center md:justify-start">
              <BookCover book={book} width={140} />
            </div>

            {/* info */}
            <div className="flex flex-1 flex-col">
              {/* title row with edit toggle */}
              <div className="flex items-start justify-between gap-4">
                {isEditing ? (
                  <div className="flex flex-1 flex-col gap-3">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        {...form.register("title")}
                        className="mt-1 text-2xl font-semibold"
                      />
                    </div>
                    <div>
                      <Label htmlFor="subtitle">Subtitle</Label>
                      <Input
                        id="subtitle"
                        {...form.register("subtitle")}
                        className="mt-1"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    <h1
                      className="font-heading text-3xl font-bold tracking-tight"
                      style={{
                        viewTransitionName: `book-title-${book.uuid}`,
                      }}
                    >
                      {book.title}
                    </h1>
                    {book.subtitle && (
                      <p className="text-muted-foreground mt-1 text-lg">
                        {book.subtitle}
                      </p>
                    )}
                  </div>
                )}

                {canEdit && (
                  <div className="flex shrink-0 items-center gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
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
                          {isSaving ? "Saving..." : "Save"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditing(true)
                        }}
                      >
                        <IconEdit className="mr-1 h-4 w-4" />
                        Edit
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* authors */}
              {authors.length > 0 && (
                <div className="text-muted-foreground mt-3 flex items-center gap-1 text-sm">
                  <span>by</span>
                  {authors.map((author, idx) => (
                    <span key={author.uuid}>
                      <V3Link
                        href={`/books?author=${author.uuid}`}
                        className="hover:text-primary text-foreground font-medium hover:underline"
                      >
                        {author.name}
                      </V3Link>
                      {idx < authors.length - 1 && ", "}
                    </span>
                  ))}
                </div>
              )}

              {/* narrators */}
              {narrators.length > 0 && (
                <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                  <span>narrated by</span>
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

              {/* series - with hover edit */}
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

              {/* spacer */}
              <div className="flex-1" />

              {/* bottom section: year + formats on left, status on right */}
              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <div className="flex flex-wrap items-center gap-4">
                  {book.publicationDate && !isEditing && (
                    <span className="text-muted-foreground text-sm">
                      {formatYear(book.publicationDate)}
                    </span>
                  )}
                  <FormatBadges book={book} />
                </div>
                <ReadingStatusButton
                  book={book}
                  canEdit={canDownload}
                  onStatusChange={() => {
                    // TODO: refetch
                  }}
                />
              </div>
            </div>
          </div>

          <Separator className="my-8" />

          {/* description */}
          <section className="mb-8">
            {isEditing ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  className="min-h-32 resize-y"
                />
              </div>
            ) : book.description ? (
              <div>
                <h2 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  Description
                </h2>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: book.description }}
                />
              </div>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                No description available
              </p>
            )}
          </section>

          {/* tags - with hover edit */}
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <IconTag className="h-4 w-4" />
              Tags
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

          {/* collections - with hover edit */}
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <IconFolder className="h-4 w-4" />
              Collections
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
            <h2 className="mb-4 text-sm font-medium">Book Details</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {isEditing ? (
                <>
                  <div>
                    <Label htmlFor="language">Language</Label>
                    <Input
                      id="language"
                      {...form.register("language")}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="publicationDate">Publication Date</Label>
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
                  <MetadataRow icon={IconLanguage} label="Language">
                    {book.language}
                  </MetadataRow>
                  <MetadataRow icon={IconCalendar} label="Publication Date">
                    {book.publicationDate && formatDate(book.publicationDate)}
                  </MetadataRow>
                  <MetadataRow icon={IconCalendar} label="Added">
                    {formatDate(book.createdAt)}
                  </MetadataRow>
                  <MetadataRow icon={IconCalendar} label="Last Updated">
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
                Other Contributors
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
                  Downloads
                </h2>
                <div className="flex flex-wrap gap-3">
                  {book.readaloud?.filepath && (
                    <Button
                      variant="outline"
                      render={
                        <V3Link href={getDownloadUrl(book.uuid, "readaloud")}>
                          <IconReadaloud className="text-st-orange-500 mr-2 h-4 w-4" />
                          Download ReadAloud
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
                          Download Ebook
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
                          Download Audiobook
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
              File Information
            </h2>
            <div className="bg-muted/50 space-y-3 rounded-lg p-4">
              {book.readaloud?.filepath && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    ReadAloud file
                  </span>
                  <code className="text-sm break-all">
                    {book.readaloud.filepath}
                  </code>
                </div>
              )}
              {book.ebook && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    Ebook file
                  </span>
                  <code className="text-sm break-all">
                    {book.ebook.filepath}
                  </code>
                </div>
              )}
              {book.audiobook && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    Audiobook file
                  </span>
                  <code className="text-sm break-all">
                    {book.audiobook.filepath}
                  </code>
                </div>
              )}
              {book.alignedAt && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    Last aligned
                  </span>
                  <span className="text-sm">{formatDate(book.alignedAt)}</span>
                </div>
              )}
              {book.alignedWith && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    Transcription engine
                  </span>
                  <span className="text-sm">{book.alignedWith}</span>
                </div>
              )}
              {book.alignedByStorytellerVersion && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    Storyteller version
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
