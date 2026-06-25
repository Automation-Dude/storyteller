"use client"

import { IconChartRadar, IconPencil, IconStar } from "@tabler/icons-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { useBookForm } from "@v3/_/components/books/BookDetails/BookFormProvider"
import { SEAMLESS_BOX } from "@/app/(v3)/v3/_/components/books/BookDetails/EditableText"
import { MultidimensionalRating } from "@v3/_/components/books/BookDetails/sections/MultidimensionalRating"
import { RatingInput } from "@v3/_/components/books/RatingInput"
import { Button } from "@v3/_/components/ui/button"
import { Field, FieldLabel } from "@v3/_/components/ui/field"
import { Textarea } from "@v3/_/components/ui/textarea"
import { useUserPreferences } from "@v3/_/components/user-preferences-provider"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import {
  type RatingDimensionScores,
  formatRating,
} from "@/database/ratingDimensions"
import {
  useDeleteBookRatingMutation,
  useSetBookRatingMutation,
} from "@/store/api"

import { ensureContrast, useCoverColors, useIsDarkMode } from "./useCoverColors"
import { CollapsibleSection } from "./CollapsibleSection"
import { TooltipButton } from "../../../ui/tooltip-button"

// inline number editor styled like EditableField (SEAMLESS_BOX), but committing
// through setBookRating since the rating is per-user and not part of the form
function InlineRatingNumber({
  value,
  placeholder,
  onCommit,
}: {
  value: number | null
  placeholder: string
  onCommit: (value: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState("")
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      ref.current?.focus()
      ref.current?.select()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = text.trim()
    if (trimmed === "") {
      onCommit(null)
      return
    }
    const num = Number(trimmed)
    if (Number.isNaN(num)) return
    const clamped = Math.min(5, Math.max(0, num))
    onCommit(Math.round(clamped * 100) / 100)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setText(value != null ? formatRating(value) : "")
          setEditing(true)
        }}
        className={cn(
          SEAMLESS_BOX,
          "hover:border-input hover:bg-input/10 w-12 cursor-text border-transparent text-sm tabular-nums",
          value == null && "text-muted-foreground italic",
        )}
      >
        {value != null ? formatRating(value) : placeholder}
      </button>
    )
  }

  return (
    <input
      ref={ref}
      type="number"
      inputMode="decimal"
      min={0}
      max={5}
      step={0.01}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          commit()
        }
        if (e.key === "Escape") {
          e.preventDefault()
          setEditing(false)
        }
      }}
      className={cn(
        SEAMLESS_BOX,
        "border-input bg-input/20 dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/30 w-14 text-sm tabular-nums outline-none focus-visible:ring-2",
      )}
    />
  )
}

export function ReviewSection({ className }: { className?: string }) {
  const { book } = useBookForm()
  const t = useTranslation("BookDetailsPage")
  const { ratingDimensions } = useUserPreferences()

  const [setBookRating, { isLoading: isSaving }] = useSetBookRatingMutation()
  const [deleteBookRating] = useDeleteBookRatingMutation()

  const currentRating = book.rating?.rating ?? null
  const currentReview = book.rating?.review ?? ""
  const currentDimensions = book.rating?.dimensions ?? null
  const hasDimensions =
    !!currentDimensions && Object.keys(currentDimensions).length > 0

  const { primary } = useCoverColors(book)
  const isDark = useIsDarkMode()
  const ratingColor = ensureContrast(primary, isDark).solid

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  const startEdit = () => {
    setDraft(currentReview)
    setEditing(true)
  }

  // a manual rating always replaces the multidimensional rating; drop the whole
  // row when there's nothing left to keep
  const applyManualRating = (value: number | null) => {
    if (value == null && !currentReview) {
      void deleteBookRating({ bookUuid: book.uuid })
      return
    }
    void setBookRating({
      bookUuid: book.uuid,
      rating: value,
      review: currentReview || null,
      dimensions: null,
    })
  }

  const addAdvancedRating = () => {
    // seed every axis with the current (snapped) star rating so converting
    // keeps the score, then let the user adjust
    const base =
      Math.round(Math.min(5, Math.max(0, currentRating ?? 0)) * 2) / 2
    const scores: RatingDimensionScores = Object.fromEntries(
      ratingDimensions.map((d) => [d.id, base]),
    )
    void setBookRating({ bookUuid: book.uuid, dimensions: scores })
  }

  const removeAdvancedRating = useCallback(() => {
    if (currentReview) {
      void setBookRating({
        bookUuid: book.uuid,
        rating: null,
        review: currentReview,
        dimensions: null,
      })
    } else {
      void deleteBookRating({ bookUuid: book.uuid })
    }
  }, [book.uuid, currentReview, deleteBookRating, setBookRating])

  const handleSaveReview = async () => {
    const text = draft.trim()
    if (!text && currentRating == null && !hasDimensions) {
      await deleteBookRating({ bookUuid: book.uuid })
    } else {
      await setBookRating({
        bookUuid: book.uuid,
        review: text || null,
      })
    }
    setEditing(false)
  }

  const handleChangeDimensions = useCallback(
    (dimensions: RatingDimensionScores) => {
      void setBookRating({ bookUuid: book.uuid, dimensions })
    },
    [book.uuid, setBookRating],
  )

  return (
    <CollapsibleSection
      title={t("review.title")}
      icon={<IconStar className="size-3.5 stroke-1" />}
      className={className}
      rightElement={
        !editing && (
          <TooltipButton
            variant="ghost"
            className="text-muted-foreground font-thin"
            onClick={(e) => {
              e.stopPropagation()
              startEdit()
            }}
            aria-label={
              currentReview ? t("review.edit") : t("review.addReview")
            }
            tooltip={currentReview ? t("review.edit") : t("review.addReview")}
          >
            <IconPencil className="size-3.5 stroke-[1.5]" />
          </TooltipButton>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {hasDimensions ? (
          <MultidimensionalRating
            dimensions={ratingDimensions}
            scores={currentDimensions}
            onChange={handleChangeDimensions}
            onRemove={removeAdvancedRating}
            color={ratingColor}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground sr-only text-xs uppercase">
              {t("review.yourRating")}
            </span>
            <RatingInput
              value={currentRating}
              onChange={applyManualRating}
              color={ratingColor}
            />
            <InlineRatingNumber
              value={currentRating}
              placeholder={t("review.ratePlaceholder")}
              onCommit={applyManualRating}
            />
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground ml-auto"
              onClick={addAdvancedRating}
            >
              <IconChartRadar className="mr-1 h-3.5 w-3.5" />
              {t("review.addAdvanced")}
            </Button>
          </div>
        )}

        {editing ? (
          <Field orientation="vertical">
            <FieldLabel htmlFor="review">{t("review.yourReview")}</FieldLabel>
            <Textarea
              id="review"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
              }}
              placeholder={t("review.reviewPlaceholder")}
              className="min-h-24 resize-y font-serif"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  void handleSaveReview()
                }}
                disabled={isSaving}
              >
                {t("review.save")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false)
                }}
                disabled={isSaving}
              >
                {t("review.cancel")}
              </Button>
            </div>
          </Field>
        ) : (
          currentReview && (
            <p className="font-serif text-sm whitespace-pre-wrap">
              {currentReview}
            </p>
          )
        )}
      </div>
    </CollapsibleSection>
  )
}
