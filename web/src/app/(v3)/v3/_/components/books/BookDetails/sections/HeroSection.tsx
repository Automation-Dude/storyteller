"use client"

import { IconBook, IconHeadphones, IconPlayerPlay } from "@tabler/icons-react"
import { useTranslations } from "next-intl"

import {
  AuthorEditor,
  NarratorEditor,
} from "@v3/_/components/books/AuthorEditor"
import { useBookForm } from "@v3/_/components/books/BookDetails/BookFormProvider"
import { CoverEditor } from "@v3/_/components/books/BookDetails/CoverEditor"
import { EditableText } from "@v3/_/components/books/BookDetails/EditableField"
import { ProgressDisplayBar } from "@v3/_/components/books/ProgressDisplayBar"
import { RatingInput } from "@v3/_/components/books/RatingInput"
import { ReadingStatusButton } from "@v3/_/components/books/ReadingStatusButton"
import { SeriesEditor } from "@v3/_/components/books/SeriesEditor"
import { Button } from "@v3/_/components/ui/button"
import { V3Link } from "@v3/_/components/v3-link"

import { cn } from "@/cn"
import {
  useDeleteBookRatingMutation,
  useSetBookRatingMutation,
} from "@/store/api"

import { useCoverColors } from "./useCoverColors"

export function HeroSection({ compact }: { compact: boolean }) {
  const { book, isEditing, editingCovers, isFieldActive } = useBookForm()
  const tLabels = useTranslations("Labels")
  const t = useTranslations("BookDetailsPage")

  const [setBookRating] = useSetBookRatingMutation()
  const [deleteBookRating] = useDeleteBookRatingMutation()

  const authors = book.authors
  const narrators = book.narrators

  const handleRatingChange = async (rating: number | null) => {
    // preserve any existing review when changing / clearing the rating; only
    // drop the whole row when there's nothing left to keep
    const review = book.rating?.review ?? null
    if (rating == null && !review) {
      await deleteBookRating({ bookUuid: book.uuid })
    } else {
      await setBookRating({ bookUuid: book.uuid, rating, review })
    }
  }

  const { primary } = useCoverColors(book)

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-5 px-6 pt-7 pb-5 text-center",
        // layout reacts to the container width (panel or full page), not the
        // viewport, so the side panel and main view share one layout
        `@xl/book:flex-row @xl/book:items-center @xl/book:gap-8 @xl/book:text-left`,
        // fixed slim height only at rest; editing needs room for the cover
        // upload slots (movement on entering edit mode is acceptable)
        !isEditing && !editingCovers && `@xl/book:h-80`,
      )}
      style={{ background: primary.alpha(0.2) }}
    >
      <CoverEditor compact={compact} />

      <div
        className={cn(
          "flex h-full w-full grow flex-col items-center gap-5",
          `@xl/book:items-start @xl/book:justify-between @xl/book:gap-1.5`,
        )}
      >
        <div
          className={cn(
            "flex w-full flex-col items-center gap-1.5",
            `@xl/book:items-start`,
          )}
        >
          <EditableText
            name="title"
            as="h1"
            className={cn(
              "font-heading w-full text-center text-xl leading-tight font-normal tracking-tight text-balance",
              `@xl/book:w-auto @xl/book:text-left`,
            )}
            placeholder={tLabels("title")}
          />

          {(book.subtitle || isFieldActive("subtitle")) && (
            <EditableText
              name="subtitle"
              as="p"
              className="text-muted-foreground font-heading text-sm italic"
              placeholder={tLabels("subtitle")}
            />
          )}

          {isEditing ? (
            <AuthorEditor />
          ) : (
            authors.length > 0 && (
              <p
                className={cn(
                  "text-muted-foreground mt-0.5 flex flex-wrap justify-center gap-x-1 text-xs",
                  `@xl/book:justify-start`,
                )}
              >
                <span>{t("writtenBy")}</span>
                {authors.map((author, idx) => (
                  <V3Link
                    key={author.uuid}
                    href={`/authors?item=${author.uuid}`}
                    className="hover:text-primary text-foreground font-serif font-medium hover:underline"
                  >
                    {author.name.trim()}
                    {idx < authors.length - 1 && <span>,</span>}
                  </V3Link>
                ))}
              </p>
            )
          )}

          {isEditing ? (
            <NarratorEditor />
          ) : (
            narrators.length > 0 && (
              <p
                className={cn(
                  "text-muted-foreground flex flex-wrap justify-center gap-x-1 text-xs",
                  `@xl/book:justify-start`,
                )}
              >
                <span className="italic">{t("narratedBy")}</span>
                {narrators.map((narrator, idx) => (
                  <V3Link
                    key={narrator.uuid}
                    href={`/narrators?item=${narrator.uuid}`}
                    className="hover:text-primary text-foreground hover:underline"
                  >
                    {narrator.name.trim()}
                    {idx < narrators.length - 1 && <span>,</span>}
                  </V3Link>
                ))}
              </p>
            )
          )}

          <div className="mt-1">
            <RatingInput
              value={book.rating?.rating ?? null}
              onChange={handleRatingChange}
            />
          </div>

          <div className="mt-1">
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
        </div>

        <div
          className={cn(
            "flex flex-wrap justify-center gap-2",
            `w-full @xl/book:justify-between`,
          )}
        >
          <ReadingStatusButton book={book} size="sm" />

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

      {book.position?.locator && (
        <ProgressDisplayBar
          progress={book.position.locator.locations?.totalProgression ?? 0}
          book={book}
        />
      )}
    </div>
  )
}
