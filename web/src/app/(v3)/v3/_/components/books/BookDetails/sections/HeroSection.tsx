"use client"

import {
  IconBook,
  IconDownload,
  IconHeadphones,
  IconPlayerPlay,
} from "@tabler/icons-react"
import { motion } from "motion/react"
import { useState } from "react"

import {
  AuthorEditor,
  NarratorEditor,
} from "@v3/_/components/books/AuthorEditor"
import { useBookForm } from "@v3/_/components/books/BookDetails/BookFormProvider"
import { CoverEditor } from "@v3/_/components/books/BookDetails/CoverEditor"
import { EditableText } from "@/app/(v3)/v3/_/components/books/BookDetails/EditableText"
import {
  ProgressDisplayBar,
  getReadingProgress,
} from "@v3/_/components/books/ProgressDisplayBar"
import { RatingDisplay, RatingInput } from "@v3/_/components/books/RatingInput"
import { ReadingStatusButton } from "@v3/_/components/books/ReadingStatusButton"
import { SeriesEditor } from "@v3/_/components/books/SeriesEditor"
import { Button } from "@v3/_/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { V3Link } from "@v3/_/components/v3-link"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { cn } from "@/cn"
import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { formatTimeHuman } from "@/components/reader/preferenceItems/formatTime"
import { usePermissions } from "@/hooks/usePermissions"
import {
  getDownloadUrl,
  useDeleteBookRatingMutation,
  useSetBookRatingMutation,
} from "@/store/api"

import {
  ensureContrast,
  useColorPreferences,
  useCoverColors,
  useIsDarkMode,
} from "./useCoverColors"
import { TooltipButton } from "../../../ui/tooltip-button"

const MAX_CREATORS = 5

export function HeroSection({ compact }: { compact: boolean }) {
  const {
    book,
    isEditing,
    editingCovers,
    isFieldActive,
    setEditingField,
    canEdit,
  } = useBookForm()
  const tLabels = useTranslation("Labels")
  const t = useTranslation("BookDetailsPage")

  const permissions = usePermissions()
  const [setBookRating] = useSetBookRatingMutation()
  const [deleteBookRating] = useDeleteBookRatingMutation()

  const authors = book.authors
  const narrators = book.narrators

  const [authorsExpanded, setAuthorsExpanded] = useState(false)
  const [narratorsExpanded, setNarratorsExpanded] = useState(false)
  const [ratingOverrideActive, setRatingOverrideActive] = useState(false)

  const visibleAuthors = authorsExpanded
    ? authors
    : authors.slice(0, MAX_CREATORS)
  const hiddenAuthorCount = authors.length - MAX_CREATORS

  const visibleNarrators = narratorsExpanded
    ? narrators
    : narrators.slice(0, MAX_CREATORS)
  const hiddenNarratorCount = narrators.length - MAX_CREATORS

  // a multidimensional rating is edited in the review section; the hero just
  // shows its computed average read-only so it can't be overridden by accident
  const hasDimensions =
    !!book.rating?.dimensions && Object.keys(book.rating.dimensions).length > 0

  const handleRatingChange = async (rating: number | null) => {
    // preserve any existing review when changing / clearing the rating; only
    // drop the whole row when there's nothing left to keep
    const review = book.rating?.review ?? null
    if (rating == null && !review) {
      await deleteBookRating({ bookUuid: book.uuid })
    } else {
      await setBookRating({
        bookUuid: book.uuid,
        rating,
        review,
        dimensions: null,
      })
    }
  }

  const { primary } = useCoverColors(book)
  const { tint } = useColorPreferences()
  const isDark = useIsDarkMode()
  const ratingColor = ensureContrast(primary, isDark).solid

  return (
    <div
      className={cn(
        "group/hero relative flex flex-col items-center gap-5 px-6 pt-7 pb-5 text-center",
        // layout reacts to the container width (panel or full page), not the
        // viewport, so the side panel and main view share one layout
        `@xl/book:flex-row @xl/book:items-center @xl/book:gap-8 @xl/book:text-left`,
        // fixed slim height only at rest; editing needs room for the cover
        // upload slots (movement on entering edit mode is acceptable)
        !isEditing && !editingCovers && `@xl/book:h-80`,
        !compact && `calc(100vw_-_60px)`,
      )}
      style={{ background: tint(primary, 0.2) }}
    >
      <CoverEditor compact={compact} />

      <motion.div
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

          {isEditing || isFieldActive("authors") ? (
            <AuthorEditor />
          ) : (
            authors.length > 0 && (
              <p
                role={canEdit ? "button" : undefined}
                tabIndex={canEdit ? 0 : undefined}
                onClick={canEdit ? () => setEditingField("authors") : undefined}
                className={cn(
                  "text-muted-foreground mt-0.5 flex flex-wrap justify-center gap-x-1 text-xs",
                  `@xl/book:justify-start`,
                  canEdit && "cursor-pointer",
                )}
              >
                <span>{t("writtenBy")}</span>

                {visibleAuthors.map((author, idx) => (
                  <span
                    key={author.uuid}
                    className="hover:text-primary text-foreground font-serif font-medium hover:underline"
                  >
                    {author.name.trim()}
                    {idx < visibleAuthors.length - 1 && <span>,</span>}
                  </span>
                ))}

                {!authorsExpanded && hiddenAuthorCount > 0 && (
                  <button
                    type="button"
                    className="hover:text-foreground underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setAuthorsExpanded(true)
                    }}
                  >
                    +{hiddenAuthorCount} more
                  </button>
                )}
              </p>
            )
          )}

          {isEditing || isFieldActive("narrators") ? (
            <NarratorEditor />
          ) : (
            narrators.length > 0 && (
              <p
                role={canEdit ? "button" : undefined}
                tabIndex={canEdit ? 0 : undefined}
                onClick={
                  canEdit ? () => setEditingField("narrators") : undefined
                }
                className={cn(
                  "text-muted-foreground flex flex-wrap justify-center gap-x-1 text-xs",
                  `@xl/book:justify-start`,
                  canEdit && "cursor-pointer",
                )}
              >
                <span className="italic">{t("narratedBy")}</span>

                {visibleNarrators.map((narrator, idx) => (
                  <span
                    key={narrator.uuid}
                    className="hover:text-primary text-foreground hover:underline"
                  >
                    {narrator.name.trim()}
                    {idx < visibleNarrators.length - 1 && <span>,</span>}
                  </span>
                ))}

                {!narratorsExpanded && hiddenNarratorCount > 0 && (
                  <button
                    type="button"
                    className="hover:text-foreground underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setNarratorsExpanded(true)
                    }}
                  >
                    +{hiddenNarratorCount} more
                  </button>
                )}
              </p>
            )
          )}

          {(() => {
            const pageCount = book.ebook?.pageCount ?? book.pageCount
            const duration = book.audiobook?.duration ?? book.duration
            const hasMetrics = pageCount != null || duration != null

            if (!hasMetrics) return null

            return (
              <p className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
                <EditableText
                  name="pageCount"
                  type="number"
                  className="w-fit min-w-16 text-xs whitespace-nowrap"
                  placeholder="Unknown page count"
                />
                {duration != null && <span>{formatTimeHuman(duration)}</span>}
              </p>
            )
          })()}

          <div className="mt-1">
            {hasDimensions && !ratingOverrideActive ? (
              <button
                type="button"
                className="cursor-pointer"
                onClick={() => setRatingOverrideActive(true)}
                title="click to override"
              >
                <RatingDisplay
                  rating={book.rating?.rating ?? null}
                  color={ratingColor}
                />
              </button>
            ) : (
              <RatingInput
                value={book.rating?.rating ?? null}
                onChange={handleRatingChange}
                color={ratingColor}
              />
            )}
          </div>

          <div
            className={cn(
              "transition-opacity",
              !book.series.length && "opacity-0",
              "group-hover/hero:opacity-100",
            )}
          >
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

          {permissions?.bookDownload &&
            (book.ebook || book.audiobook || book.readaloud?.filepath) && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <TooltipButton
                      variant="outline"
                      size="icon-sm"
                      className="border-primary text-primary"
                      aria-label={t("downloads.download")}
                      tooltip={t("downloads.download")}
                    >
                      <IconDownload className="size-3.5 stroke-[1.5]" />
                    </TooltipButton>
                  }
                />
                <DropdownMenuContent align="end" className="w-fit">
                  {book.readaloud?.filepath && (
                    <DropdownMenuItem
                      render={
                        <a
                          href={getDownloadUrl(book.uuid, "readaloud")}
                          download
                        >
                          <IconReadaloud className="text-st-orange-500 mr-2 h-4 w-4" />
                          {t("downloads.downloadReadaloud")}
                        </a>
                      }
                    />
                  )}

                  {book.ebook && (
                    <DropdownMenuItem
                      render={
                        <a href={getDownloadUrl(book.uuid, "ebook")} download>
                          <IconBook className="mr-2 h-4 w-4" />
                          {t("downloads.downloadEbook")}
                        </a>
                      }
                    />
                  )}

                  {book.audiobook && (
                    <DropdownMenuItem
                      render={
                        <a
                          href={getDownloadUrl(book.uuid, "audiobook")}
                          download
                        >
                          <IconHeadphones className="mr-2 h-4 w-4" />
                          {t("downloads.downloadAudiobook")}
                        </a>
                      }
                    />
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
        </div>
      </motion.div>

      {getReadingProgress(book) !== null && (
        <ProgressDisplayBar
          progress={getReadingProgress(book) ?? 0}
          book={book}
          className="absolute right-0 bottom-0 left-0 rounded-none"
        />
      )}
    </div>
  )
}
