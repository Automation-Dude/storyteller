"use client"

import { type UUID } from "crypto"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  IconAlertTriangle,
  IconBook,
  IconCalendar,
  IconCamera,
  IconCheck,
  IconDownload,
  IconEdit,
  IconFileText,
  IconFolder,
  IconHeadphones,
  IconLanguage,
  IconPlayerPlay,
  IconPlus,
  IconProgress,
  IconTag,
  IconTrash,
  IconUser,
  IconX,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
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
  useCancelProcessingMutation,
  useDeleteBookMutation,
  useGetBookQuery,
  useProcessBookMutation,
  useUpdateBookMutation,
} from "@/store/api"

import { BookCover } from "@v3/_/components/books/BookCover"
import { BookDetailsSkeleton } from "@v3/_/components/books/BookDetailsSkeleton"
import { CollectionEditor } from "@v3/_/components/books/CollectionEditor"
import { RatingInput } from "@v3/_/components/books/RatingInput"
import { ReadingStatusButton } from "@v3/_/components/books/ReadingStatusButton"
import { SeriesEditor } from "@v3/_/components/books/SeriesEditor"
import { TagEditor } from "@v3/_/components/books/TagEditor"
import { SiteHeader } from "@v3/_/components/site-header"
import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import { Input } from "@v3/_/components/ui/input"
import { Label } from "@v3/_/components/ui/label"
import { Separator } from "@v3/_/components/ui/separator"
import { Textarea } from "@v3/_/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v3/_/components/ui/select"
import { V3Link } from "@v3/_/components/v3-link"

import {
  creatorRelators,
  type Role,
} from "@/components/books/edit/marcRelators"

function getLanguageDisplayName(code: string): string | null {
  const trimmed = code.trim()

  if (!trimmed) {
    return null
  }

  try {
    new Intl.Locale(trimmed)
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" })
    const name = displayNames.of(trimmed)

    if (!name || name === trimmed) {
      return null
    }

    return name
  } catch {
    return null
  }
}

type EditableCreator = {
  name: string
  role: string
}

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

// function FormatBadges({ book }: { book: BookWithRelations }) {
//   const hasEbook = book.ebook !== null
//   const hasAudiobook = book.audiobook !== null
//   const isSynced =
//     book.readaloud !== null && book.readaloud.status === "ALIGNED"

//   return (
//     <div className="flex flex-wrap gap-2">
//       {isSynced && (
//         <Badge className="gap-1 bg-orange-500 text-white hover:bg-orange-600">
//           <IconReadaloud className="size-6" />
//           ReadAloud
//         </Badge>
//       )}
//       {hasEbook && (
//         <Badge variant="secondary" className="gap-1">
//           <IconBook className="h-3 w-3" />
//           Ebook
//         </Badge>
//       )}
//       {hasAudiobook && (
//         <Badge variant="secondary" className="gap-1">
//           <IconHeadphones className="h-3 w-3" />
//           Audiobook
//         </Badge>
//       )}
//     </div>
//   )
// }

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
  canEdit = false,
  canDownload = false,
  canDelete = false,
  initialBook,
  isEditing: controlledIsEditing,
  onEditingChange,
}: {
  uuid: UUID
  initialBook?: BookWithRelations
  compact?: boolean
  canEdit?: boolean
  canDownload?: boolean
  canDelete?: boolean
  isEditing?: boolean
  onEditingChange?: (editing: boolean) => void
}) {
  const router = useRouter()
  const { data: queryBook, isLoading: isLoadingBook } = useGetBookQuery({
    uuid,
  })
  const [updateBook, { isLoading: isSaving }] = useUpdateBookMutation()
  const [deleteBook] = useDeleteBookMutation()
  const [processBook] = useProcessBookMutation()
  const [cancelProcessing] = useCancelProcessingMutation()
  const [localIsEditing, setLocalIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteAssetMode, setDeleteAssetMode] = useState<
    "" | "internal" | "all"
  >("")
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
  const [newAuthor, setNewAuthor] = useState("")
  const [newNarrator, setNewNarrator] = useState("")
  const textCoverRef = useRef<HTMLInputElement>(null)
  const [textCoverFile, setTextCoverFile] = useState<File | null>(null)
  const [audioCoverFile, setAudioCoverFile] = useState<File | null>(null)
  const [textCoverPreview, setTextCoverPreview] = useState<string | null>(null)

  const book = queryBook ?? initialBook

  const form = useForm<BookFormValues>({
    resolver: zodResolver(bookFormSchema),
  })

  const languageValue = form.watch("language")

  const languageDisplayName = useMemo(
    () => getLanguageDisplayName(languageValue ?? ""),
    [languageValue],
  )

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

  useEffect(() => {
    if (!book || !isEditing) {
      return
    }

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
  }, [isEditing, book])

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

  const authors = book.authors
  const narrators = book.narrators

  return (
    <div className="relative flex flex-1 flex-col">
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
              {isEditing ? (
                <div className="relative">
                  {textCoverPreview ? (
                    <img
                      src={textCoverPreview}
                      alt="New cover"
                      className="h-full w-full rounded-lg object-contain"
                      style={{
                        maxWidth: compact ? 176 : 200,
                        maxHeight: compact ? 280 : 300,
                      }}
                    />
                  ) : (
                    <BookCover
                      book={book}
                      width={compact ? 176 : 200}
                      key={book.uuid}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => textCoverRef.current?.click()}
                    className="absolute flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg bg-black/50 transition-opacity hover:opacity-100"
                  >
                    <IconCamera className="h-6 w-6 text-white" />
                    <span className="text-xs text-white">Change cover</span>
                  </button>

                  <input
                    ref={textCoverRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) {
                        return
                      }

                      setTextCoverFile(file)
                      setAudioCoverFile(file)
                      setTextCoverPreview(URL.createObjectURL(file))
                    }}
                  />
                </div>
              ) : (
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

                  <DialogContent className="p-0!">
                    <BookCover book={book} width={400} key={book.uuid} />
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="flex flex-1 flex-col">
              <div className="flex items-start justify-between gap-4">
                {isEditing ? (
                  <div className="flex flex-1 flex-col gap-3">
                    <div>
                      <Input
                        id="title"
                        {...form.register("title")}
                        className="mt-1 text-2xl font-semibold"
                        placeholder={tLabels("title")}
                        aria-label={tLabels("title")}
                      />
                    </div>
                    <div>
                      <Input
                        id="subtitle"
                        {...form.register("subtitle")}
                        className="mt-1"
                        placeholder={tLabels("subtitle")}
                        aria-label={tLabels("subtitle")}
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

              {isEditing ? (
                <div className="mt-3 flex flex-col gap-2">
                  <span className="text-muted-foreground text-xs font-medium uppercase">
                    {tLabels("authors")}
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {editAuthors.map((name, idx) => (
                      <Badge key={idx} variant="outline" className="gap-1">
                        {name}
                        <button
                          type="button"
                          onClick={() => {
                            setEditAuthors((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }}
                          className="hover:bg-destructive/20 ml-0.5 rounded-full p-0.5"
                        >
                          <IconX className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}

                    <form
                      className="flex items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault()
                        const trimmed = newAuthor.trim()

                        if (trimmed) {
                          setEditAuthors((prev) => [...prev, trimmed])
                          setNewAuthor("")
                        }
                      }}
                    >
                      <Input
                        value={newAuthor}
                        onChange={(e) => setNewAuthor(e.target.value)}
                        placeholder={t("addAuthor")}
                        className="h-7 w-40 text-sm"
                      />

                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        disabled={!newAuthor.trim()}
                      >
                        <IconPlus className="h-3 w-3" />
                      </Button>
                    </form>
                  </div>
                </div>
              ) : (
                authors.length > 0 && (
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
                )
              )}

              {isEditing ? (
                <div className="mt-2 flex flex-col gap-2">
                  <span className="text-muted-foreground text-xs font-medium uppercase">
                    {tLabels("narrators")}
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {editNarrators.map((name, idx) => (
                      <Badge key={idx} variant="outline" className="gap-1">
                        {name}
                        <button
                          type="button"
                          onClick={() => {
                            setEditNarrators((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }}
                          className="hover:bg-destructive/20 ml-0.5 rounded-full p-0.5"
                        >
                          <IconX className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}

                    <form
                      className="flex items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault()
                        const trimmed = newNarrator.trim()

                        if (trimmed) {
                          setEditNarrators((prev) => [...prev, trimmed])
                          setNewNarrator("")
                        }
                      }}
                    >
                      <Input
                        value={newNarrator}
                        onChange={(e) => setNewNarrator(e.target.value)}
                        placeholder={t("addNarrator")}
                        className="h-7 w-40 text-sm"
                      />

                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        disabled={!newNarrator.trim()}
                      >
                        <IconPlus className="h-3 w-3" />
                      </Button>
                    </form>
                  </div>
                </div>
              ) : (
                narrators.length > 0 && (
                  <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
                    <span>{t("narratedBy")}</span>
                    {narrators.map((narrator, idx) => (
                      <span key={narrator.uuid}>
                        <span className="text-foreground">{narrator.name}</span>
                        {idx < narrators.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                )
              )}

              <div className="mt-3">
                <RatingInput
                  value={book.rating}
                  onChange={handleRatingChange}
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

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-4">
                <ReadingStatusButton book={book} />

                {book.publicationDate && !isEditing && (
                  <span className="text-muted-foreground ml-auto text-sm">
                    {formatYear(book.publicationDate)}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {book.readaloud?.status === "ALIGNED" && (
                  <Button
                    variant="default"
                    size="sm"
                    nativeButton={false}
                    render={
                      <V3Link href={`/books/${book.uuid}/read?mode=readaloud`}>
                        <IconPlayerPlay className="mr-1 h-4 w-4" />
                        Read
                      </V3Link>
                    }
                  />
                )}

                {book.readaloud?.status !== "ALIGNED" && book.ebook && (
                  <Button
                    variant="default"
                    size="sm"
                    nativeButton={false}
                    render={
                      <V3Link href={`/books/${book.uuid}/read?mode=epub`}>
                        <IconBook className="mr-1 h-4 w-4" />
                        Read
                      </V3Link>
                    }
                  />
                )}

                {book.readaloud?.status !== "ALIGNED" && book.audiobook && (
                  <Button
                    variant="default"
                    size="sm"
                    nativeButton={false}
                    render={
                      <V3Link href={`/books/${book.uuid}/read?mode=audiobook`}>
                        <IconHeadphones className="mr-1 h-4 w-4" />
                        Listen
                      </V3Link>
                    }
                  />
                )}
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
                      placeholder="e.g. en, nl, fr-FR"
                    />
                    {languageValue && (
                      <p
                        className={cn(
                          "mt-1 text-xs",
                          languageDisplayName
                            ? "text-muted-foreground"
                            : "text-destructive",
                        )}
                      >
                        {languageDisplayName ?? t("invalidLanguageCode")}
                      </p>
                    )}
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

          <Separator className="my-8" />
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-medium">
              <IconFileText className="h-4 w-4" />
              {t("fileInformation.title")}
            </h2>
            <div className="bg-muted/50 space-y-3 rounded-lg p-4">
              {book.readaloud?.filepath && (
                <FilePathRow
                  label={t("fileInformation.readaloud")}
                  filepath={book.readaloud.filepath}
                  missing={book.readaloud.missing}
                />
              )}

              {book.ebook && (
                <FilePathRow
                  label={t("fileInformation.ebook")}
                  filepath={book.ebook.filepath}
                  missing={book.ebook.missing}
                />
              )}

              {book.audiobook && (
                <FilePathRow
                  label={t("fileInformation.audiobook")}
                  filepath={book.audiobook.filepath}
                  missing={book.audiobook.missing}
                />
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

          {canDelete && (
            <>
              <Separator className="my-8" />
              <section className="mb-8">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <IconTrash className="mr-1 h-4 w-4" />
                  {t("deleteBook")}
                </Button>

                <Dialog
                  open={showDeleteDialog}
                  onOpenChange={setShowDeleteDialog}
                >
                  <DialogContent>
                    <div className="flex flex-col gap-4 p-6">
                      <h3 className="text-lg font-semibold">
                        {t("deleteBook")}
                      </h3>

                      <p className="text-muted-foreground text-sm">
                        Are you sure you want to delete{" "}
                        <strong className="text-foreground">
                          {book.title}
                        </strong>
                        {book.authors[0] && <> by {book.authors[0].name}</>}?
                      </p>

                      <fieldset className="flex flex-col gap-2">
                        <legend className="mb-2 text-sm font-medium">
                          Delete files?
                        </legend>

                        {(
                          [
                            {
                              value: "" as const,
                              label: "Leave all files in place",
                            },
                            {
                              value: "internal" as const,
                              label:
                                "Delete Storyteller files (transcriptions, processed audio)",
                            },
                            {
                              value: "all" as const,
                              label:
                                "Delete all files, including book assets (EPUB and audio)",
                            },
                          ] as const
                        ).map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="radio"
                              name="deleteAssetMode"
                              value={option.value}
                              checked={deleteAssetMode === option.value}
                              onChange={() => setDeleteAssetMode(option.value)}
                              className="accent-primary"
                            />
                            {option.label}
                          </label>
                        ))}
                      </fieldset>

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDeleteDialog(false)}
                        >
                          Cancel
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={async () => {
                            await deleteBook({
                              uuid: book.uuid,
                              ...(deleteAssetMode && {
                                includeAssets: deleteAssetMode,
                              }),
                            })
                            setShowDeleteDialog(false)
                            router.push("/v3/books")
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const PROCESSING_STAGE_LABELS: Record<string, string> = {
  SPLIT_TRACKS: "Pre-processing audio",
  TRANSCRIBE_CHAPTERS: "Transcribing tracks",
  SYNC_CHAPTERS: "Synchronizing chapters",
}

function TranscriptionStatus({
  book,
  onProcess,
  onCancel,
}: {
  book: BookWithRelations
  onProcess: () => void
  onCancel: () => void
}) {
  const hasEbook = book.ebook !== null
  const hasAudiobook = book.audiobook !== null
  const canCreateReadaloud = hasEbook && hasAudiobook && !book.readaloud

  const readaloudStatus = book.readaloud?.status

  if (!readaloudStatus && !canCreateReadaloud) {
    return null
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <IconProgress className="h-4 w-4" />
        Transcription
      </h2>

      <div className="bg-muted/50 rounded-lg p-4">
        {readaloudStatus === "ALIGNED" && (
          <div className="flex items-center gap-2 text-sm">
            <IconCheck className="h-4 w-4 text-green-600" />
            <span>Aligned</span>
          </div>
        )}

        {readaloudStatus === "QUEUED" && (
          <div className="flex items-center justify-between">
            <span className="text-sm">Queued for alignment</span>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <IconX className="mr-1 h-3 w-3" />
              Cancel
            </Button>
          </div>
        )}

        {readaloudStatus === "PROCESSING" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {PROCESSING_STAGE_LABELS[book.readaloud?.currentStage ?? ""] ??
                  "Processing"}
              </span>
              <Button variant="ghost" size="sm" onClick={onCancel}>
                <IconX className="mr-1 h-3 w-3" />
                Cancel
              </Button>
            </div>

            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{
                  width: `${Math.floor((book.readaloud?.stageProgress ?? 0) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {(readaloudStatus === "ERROR" || readaloudStatus === "STOPPED") && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <IconAlertTriangle className="text-destructive h-4 w-4" />
              <span>
                {readaloudStatus === "ERROR"
                  ? "Processing failed"
                  : "Processing stopped"}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={onProcess}>
              Retry
            </Button>
          </div>
        )}

        {canCreateReadaloud && (
          <Button variant="outline" size="sm" onClick={onProcess}>
            <IconReadaloud className="mr-1 h-4 w-4" />
            Create readaloud
          </Button>
        )}
      </div>
    </section>
  )
}

function FilePathRow({
  label,
  filepath,
  missing,
}: {
  label: string
  filepath: string
  missing: boolean
}) {
  const lastSlash = filepath.lastIndexOf("/")
  const directory = lastSlash >= 0 ? filepath.slice(0, lastSlash + 1) : ""
  const filename = lastSlash >= 0 ? filepath.slice(lastSlash + 1) : filepath

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          {label}
        </span>

        {!!missing && (
          <Badge variant="destructive" className="h-4 gap-0.5 px-1 text-[10px]">
            <IconAlertTriangle className="h-2.5 w-2.5" />
            Missing
          </Badge>
        )}
      </div>

      <div className="text-sm" title={filepath}>
        <span className="text-muted-foreground">{directory}</span>
        <code className="font-mono font-medium">{filename}</code>
      </div>
    </div>
  )
}
