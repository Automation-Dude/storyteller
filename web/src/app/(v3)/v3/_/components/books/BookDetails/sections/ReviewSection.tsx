"use client"

import { IconPencil, IconStar } from "@tabler/icons-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { useBookForm } from "@v3/_/components/books/BookDetails/BookFormProvider"
import { RatingInput } from "@v3/_/components/books/RatingInput"
import { Button } from "@v3/_/components/ui/button"
import { Field, FieldLabel } from "@v3/_/components/ui/field"
import { Textarea } from "@v3/_/components/ui/textarea"

import {
  useDeleteBookRatingMutation,
  useSetBookRatingMutation,
} from "@/store/api"

export function ReviewSection({ className }: { className?: string }) {
  const { book } = useBookForm()
  const t = useTranslations("BookDetailsPage")

  const [setBookRating, { isLoading: isSaving }] = useSetBookRatingMutation()
  const [deleteBookRating] = useDeleteBookRatingMutation()

  const currentRating = book.rating?.rating ?? null
  const currentReview = book.rating?.review ?? ""

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  const startEdit = () => {
    setDraft(currentReview)
    setEditing(true)
  }

  const handleRatingChange = async (value: number | null) => {
    // clearing the rating with no review removes the row entirely; otherwise
    // keep the review so it isn't dropped (and so the server doesn't 405 on a
    // request with neither field set)
    if (value == null && !currentReview) {
      await deleteBookRating({ bookUuid: book.uuid })
      return
    }
    await setBookRating({
      bookUuid: book.uuid,
      rating: value,
      review: currentReview || null,
    })
  }

  const handleSaveReview = async () => {
    const text = draft.trim()
    if (!text && currentRating == null) {
      await deleteBookRating({ bookUuid: book.uuid })
    } else {
      await setBookRating({
        bookUuid: book.uuid,
        rating: currentRating,
        review: text || null,
      })
    }
    setEditing(false)
  }

  return (
    <section className={className}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-label flex-1">
          <IconStar className="h-4 w-4" />
          {t("review.title")}
        </h2>

        {!editing && (
          <Button size="sm" variant="ghost" onClick={startEdit}>
            <IconPencil className="mr-1 h-3.5 w-3.5" />
            {currentReview ? t("review.edit") : t("review.addReview")}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs uppercase">
            {t("review.yourRating")}
          </span>
          <RatingInput value={currentRating} onChange={handleRatingChange} />
        </div>

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
              className="min-h-24 resize-y"
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
            <p className="text-sm whitespace-pre-wrap">{currentReview}</p>
          )
        )}
      </div>
    </section>
  )
}
