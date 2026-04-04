"use client"

import {
  IconBook,
  IconHeadphones,
  IconPlayerPlay,
} from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { Fragment } from "react"

import { RatingInput } from "@v3/_/components/books/RatingInput"
import { ReadingStatusButton } from "@v3/_/components/books/ReadingStatusButton"
import { SeriesEditor } from "@v3/_/components/books/SeriesEditor"
import { Input } from "@v3/_/components/ui/input"
import { Button } from "@v3/_/components/ui/button"
import { V3Link } from "@v3/_/components/v3-link"
import { cn } from "@v3/_/lib/utils"

import { useBookForm } from "../BookFormProvider"
import { ChipListField } from "../ChipListField"
import { CoverEditor } from "../CoverEditor"

export function HeroSection({ compact }: { compact: boolean }) {
  const { book, form, isEditing, submitPartial } = useBookForm()
  const tLabels = useTranslations("Labels")
  const t = useTranslations("BookDetailsPage")

  const authors = book.authors
  const narrators = book.narrators
  const formAuthors = form.watch("authors")
  const formNarrators = form.watch("narrators")

  const handleRatingChange = async (rating: number | null) => {
    await submitPartial({ rating })
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
        <CoverEditor compact={compact} />
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          {isEditing ? (
            <div className="flex flex-1 flex-col gap-3">
              <Input
                id="title"
                {...form.register("title")}
                className="mt-1 text-2xl font-semibold"
                placeholder={tLabels("title")}
                aria-label={tLabels("title")}
              />

              <Input
                id="subtitle"
                {...form.register("subtitle")}
                className="mt-1"
                placeholder={tLabels("subtitle")}
                aria-label={tLabels("subtitle")}
              />
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
          <div className="mt-3">
            <ChipListField
              values={formAuthors}
              onChange={(values) => form.setValue("authors", values)}
              label={tLabels("authors")}
              addPlaceholder={t("addAuthor")}
            />
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
          <div className="mt-2">
            <ChipListField
              values={formNarrators}
              onChange={(values) => form.setValue("narrators", values)}
              label={tLabels("narrators")}
              addPlaceholder={t("addNarrator")}
            />
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
            onUpdate={() => {}}
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
