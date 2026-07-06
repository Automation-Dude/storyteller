"use client"

import { motion } from "motion/react"
import { useState } from "react"

import {
  AuthorEditor,
  NarratorEditor,
} from "@v3/_/components/books/AuthorEditor"
import { useBookForm } from "@v3/_/components/books/BookDetails/BookFormProvider"
import { CoverEditor } from "@v3/_/components/books/BookDetails/CoverEditor"
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
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"
import { bookDuration, bookPageCount } from "@v3/_/lib/bookMetrics"

import { EditableText } from "@/app/(v3)/v3/_/components/books/BookDetails/EditableText"
import {
  DurationEdit,
  PageCountEdit,
} from "@/app/(v3)/v3/_/components/books/BookDetails/MetricEdit"
import { IAdd } from "@/app/(v3)/v3/_/components/ui/icon"
import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import { cn } from "@/cn"
import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { usePermissions } from "@/hooks/usePermissions"
import { type StyledIcon } from "@/icons"
import * as icon from "@/icons"
import {
  getDownloadUrl,
  useDeleteUserBookRatingMutation,
  useSetUserBookRatingMutation,
} from "@/store/api"

import { ensureContrast, useCoverColors, useIsDarkMode } from "./useCoverColors"

const MAX_CREATORS = 5

export function HeroSection({
  compact,
  className,
}: {
  compact: boolean
  className?: string
}) {
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
  const c = useCommon()

  const permissions = usePermissions()
  const [setUserBookRating] = useSetUserBookRatingMutation()
  const [deleteUserBookRating] = useDeleteUserBookRatingMutation()

  const authors = book.authors
  const narrators = book.narrators

  const [authorsExpanded, setAuthorsExpanded] = useState(false)
  const [narratorsExpanded, setNarratorsExpanded] = useState(false)
  const [ratingOverrideActive, setRatingOverrideActive] = useState(false)
  // series isn't part of the book form (separate mutations), so adding when
  // empty is gated on a local flag instead of editingField
  const [addingSeries, setAddingSeries] = useState(false)

  const visibleAuthors = authorsExpanded
    ? authors
    : authors.slice(0, MAX_CREATORS)
  const hiddenAuthorCount = authors.length - MAX_CREATORS

  const visibleNarrators = narratorsExpanded
    ? narrators
    : narrators.slice(0, MAX_CREATORS)
  const hiddenNarratorCount = narrators.length - MAX_CREATORS

  const hasDimensions =
    !!book.userBookRating?.dimensions &&
    Object.keys(book.userBookRating.dimensions).length > 0

  const handleRatingChange = async (rating: number | null) => {
    const review = book.userBookRating?.review ?? null
    const dims = book.userBookRating?.dimensions ?? null
    if (rating == null && !review && !dims) {
      await deleteUserBookRating({ bookUuid: book.uuid })
    } else {
      await setUserBookRating({ bookUuid: book.uuid, rating })
    }
  }

  const { primary } = useCoverColors(book)
  const isDark = useIsDarkMode()
  const ratingColor = ensureContrast(primary, isDark).solid

  return (
    <div
      className={cn(
        "from-cover-header/80 to-cover-well/80 relative bg-linear-to-t",
      )}
    >
      <div
        className={cn(
          "group/hero relative flex flex-col items-center gap-5 px-6 pt-14 pb-5 text-center",
          `@xl/book:flex-row @xl/book:items-center @xl/book:gap-8 @xl/book:text-left`,
          !isEditing && !editingCovers && `@xl/book:h-80`,
          // !compact && `w-screen`,
          className,
        )}
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
              "flex w-full flex-col items-center gap-1",
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
              placeholder={c.plain("fields.label.title")}
            />

            {(book.subtitle || isFieldActive("subtitle")) && (
              <EditableText
                name="subtitle"
                as="p"
                className="font-heading text-tinted -mt-1 text-sm italic"
                placeholder={c.plain("fields.label.subtitle")}
              />
            )}

            {isEditing || isFieldActive("authors") ? (
              <AuthorEditor />
            ) : (
              authors.length > 0 && (
                <p
                  role={canEdit ? "button" : undefined}
                  tabIndex={canEdit ? 0 : undefined}
                  onClick={
                    canEdit
                      ? () => {
                          setEditingField("authors")
                        }
                      : undefined
                  }
                  className={cn(
                    "text-muted-foreground mt-0.5 flex flex-wrap justify-center gap-x-1 text-xs",
                    `@xl/book:justify-start`,
                    canEdit && "cursor-pointer",
                  )}
                >
                  <span className="text-tinted font-serif">
                    {t("writtenBy")}
                  </span>

                  {visibleAuthors.map((author, idx) => (
                    <span
                      key={author.uuid}
                      className="hover:text-tinted-strong text-foreground font-serif font-medium hover:underline"
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
                    canEdit
                      ? () => {
                          setEditingField("narrators")
                        }
                      : undefined
                  }
                  className={cn(
                    "text-muted-foreground flex flex-wrap justify-center gap-x-1 text-xs",
                    `@xl/book:justify-start`,
                    canEdit && "cursor-pointer",
                  )}
                >
                  <span className="text-tinted font-heading italic">
                    {t("narratedBy")}
                  </span>

                  {visibleNarrators.map((narrator, idx) => (
                    <span
                      key={narrator.uuid}
                      className="hover:text-tinted-strong text-foreground hover:underline"
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
              const pageCount = bookPageCount(book)
              const duration = bookDuration(book)
              const hasMetrics =
                pageCount != null || duration != null || canEdit

              if (!hasMetrics) return null

              return (
                <p
                  className={cn(
                    "text-tinted flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs",
                    `@xl/book:justify-start`,
                  )}
                >
                  {(book.pageCount || book.ebook || book.readaloud) && (
                    <PageCountEdit />
                  )}
                  {(book.duration || book.audiobook || book.readaloud) && (
                    <DurationEdit />
                  )}
                </p>
              )
            })()}

            <div className="mt-1">
              {hasDimensions && !ratingOverrideActive ? (
                <button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => {
                    setRatingOverrideActive(true)
                  }}
                  title="click to override"
                >
                  <RatingDisplay
                    rating={book.userBookRating?.rating ?? null}
                    color={ratingColor}
                  />
                </button>
              ) : (
                <RatingInput
                  value={book.userBookRating?.rating ?? null}
                  onChange={handleRatingChange}
                  color={ratingColor}
                />
              )}
            </div>

            {(book.series.length > 0 || isEditing || addingSeries) && (
              <div>
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
            )}
          </div>

          <div
            className={cn(
              "flex flex-wrap justify-center gap-2",
              `w-full @xl/book:justify-between`,
            )}
          >
            <div className="flex grow flex-wrap justify-center gap-2 @xl/book:justify-start">
              <ReadingStatusButton book={book} size="sm" />

              <div className="flex flex-wrap justify-center gap-2">
                {book.readaloud?.status === "ALIGNED" && (
                  <Button
                    variant="default"
                    size="sm"
                    nativeButton={false}
                    render={
                      <V3Link href={`/books/${book.uuid}/read?mode=readaloud`}>
                        <icon.Readaloud className="h-4 w-4" />
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
                        <icon.BookAlt className="mr-1 h-4 w-4" />
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
                        <icon.Headphones className="mr-1 h-4 w-4" />
                        Listen
                      </V3Link>
                    }
                  />
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 self-end">
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
                          <icon.Download className="size-3.5 stroke-[1.5]" />
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
                            <a
                              href={getDownloadUrl(book.uuid, "ebook")}
                              download
                            >
                              <icon.BookAlt className="mr-2 h-4 w-4" />
                              {t("downloads.downloadEbook")}
                            </a>
                          }
                        />
                      )}

                      {book.audiobook && (
                        <DropdownMenuItem
                          disabled={book.audiobook.missing}
                          render={
                            <a
                              href={getDownloadUrl(book.uuid, "audiobook")}
                              download
                            >
                              <icon.Headphones className="mr-2 h-4 w-4" />
                              {t("downloads.downloadAudiobook")}
                              {book.audiobook.missing && (
                                <span className="text-bad">
                                  {tLabels("missing")}
                                </span>
                              )}
                            </a>
                          }
                        />
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

              {canEdit && !isEditing && (
                <QuickAddEmptyFields
                  showSubtitle={!book.subtitle && !isFieldActive("subtitle")}
                  showNarrators={
                    narrators.length === 0 && !isFieldActive("narrators")
                  }
                  showSeries={book.series.length === 0 && !addingSeries}
                  onAddSubtitle={() => {
                    setEditingField("subtitle")
                  }}
                  onAddNarrators={() => {
                    setEditingField("narrators")
                  }}
                  onAddSeries={() => {
                    setAddingSeries(true)
                  }}
                />
              )}
            </div>
          </div>
        </motion.div>
      </div>
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

function QuickAddEmptyFields({
  showSubtitle,
  showNarrators,
  showSeries,
  onAddSubtitle,
  onAddNarrators,
  onAddSeries,
}: {
  showSubtitle: boolean
  showNarrators: boolean
  showSeries: boolean
  onAddSubtitle: () => void
  onAddNarrators: () => void
  onAddSeries: () => void
}) {
  const tLabels = useTranslation("Labels")
  const tFields = useTranslation("Common.fields.label")
  const c = useCommon()

  const chips: {
    key: string
    label: string
    onClick: () => void
    icon: StyledIcon
  }[] = []
  if (showSubtitle)
    chips.push({
      key: "subtitle",
      icon: icon.H2,
      label: c("fields.label.subtitle"),
      onClick: onAddSubtitle,
    })
  if (showNarrators)
    chips.push({
      key: "narrators",
      icon: icon.Microphone,
      label: tLabels("narrators"),
      onClick: onAddNarrators,
    })
  if (showSeries)
    chips.push({
      key: "series",
      icon: icon.List,
      label: tFields("series"),
      onClick: onAddSeries,
    })
  if (chips.length === 0) return null

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <TooltipButton
            className={cn("rounded-full")}
            tooltip={c("actions.add")}
            aria-label={c("actions.add")}
          >
            <IAdd.base className="size-3.5 stroke-[1.5]" />
          </TooltipButton>
        }
      />
      <DropdownMenuContent align="end" className="w-fit">
        {chips.map((chip) => (
          <DropdownMenuItem key={chip.key} onClick={chip.onClick}>
            <chip.icon className="size-3.5 stroke-[1.5]" />
            <span className="grow">{chip.label}</span>
            <IAdd.base className="h-3 w-3" />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
