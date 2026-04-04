"use client"

import {
  IconBook,
  IconCamera,
  IconHeadphones,
  IconPlayerPlay,
  IconPlus,
  IconX,
} from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { Fragment, useRef, useState } from "react"
import { type UseFormReturn } from "react-hook-form"

import { BookCover } from "@v3/_/components/books/BookCover"
import { RatingInput } from "@v3/_/components/books/RatingInput"
import { ReadingStatusButton } from "@v3/_/components/books/ReadingStatusButton"
import { SeriesEditor } from "@v3/_/components/books/SeriesEditor"
import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@v3/_/components/ui/dialog"
import { Input } from "@v3/_/components/ui/input"
import { V3Link } from "@v3/_/components/v3-link"
import { type BookWithRelations } from "@/database/books"
import { useUpdateBookMutation } from "@/store/api"

import { cn } from "@v3/_/lib/utils"

import { type BookFormValues } from "./schema"

export function HeroSection({
  book,
  isEditing,
  form,
  compact,
}: {
  book: BookWithRelations
  isEditing: boolean
  form: UseFormReturn<BookFormValues>
  compact: boolean
}) {
  const tLabels = useTranslations("Labels")
  const t = useTranslations("BookDetailsPage")
  const [textCoverPreview, setTextCoverPreview] = useState<string | null>(null)
  const textCoverRef = useRef<HTMLInputElement>(null)

  const [updateBook] = useUpdateBookMutation()

  const authors = book.authors
  const narrators = book.narrators

  const handleRatingChange = async (rating: number | null) => {
    await updateBook({
      update: {
        uuid: book.uuid,
        rating,
      },
    })
  }

  return (
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

                form.setValue("textCover", file)
                form.setValue("audioCover", null)
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
                      setEditAuthors((prev) => prev.filter((_, i) => i !== idx))
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
                  onChange={(e) => {
                    setNewAuthor(e.target.value)
                  }}
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
                  onChange={(e) => {
                    setNewNarrator(e.target.value)
                  }}
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
          <RatingInput value={book.rating} onChange={handleRatingChange} />
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
              {new Date(book.publicationDate).getFullYear()}
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
  )
}
