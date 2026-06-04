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
  useGetBookRatingQuery,
  useSetBookRatingMutation,
} from "@/store/api"

export function ReviewSection({ className }: { className?: string }) {
  const { book } = useBookForm()
  const t = useTranslations("BookDetailsPage")

  const { data: rating } = useGetBookRatingQuery({ bookUuid: book.uuid })
  const [setBookRating, { isLoading: isSaving }] = useSetBookRatingMutation()
  const [deleteBookRating] = useDeleteBookRatingMutation()

  const currentRating = rating?.rating ?? null
  const currentReview = rating?.review ?? ""

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  const startEdit = () => {
    setDraft(currentReview)
    setEditing(true)
  }

  const handleRatingChange = async (value: number | null) => {
    // clearing the only signal we have removes the row entirely
    if (value == null && !currentReview) {
      await deleteBookRating({ bookUuid: book.uuid })
      return
    }
    await setBookRating({ bookUuid: book.uuid, rating: value })
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
      <h2 className="section-label mb-3">
        <IconStar className="h-4 w-4" />
        {t("review.title")}
      </h2>

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
        ) : currentReview ? (
          <button
            type="button"
            onClick={startEdit}
            className="group hover:bg-input/10 -mx-1.5 rounded-md px-1.5 py-1 text-left transition-colors"
          >
            <p className="text-sm whitespace-pre-wrap">{currentReview}</p>
            <span className="text-primary mt-1 inline-flex items-center gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
              <IconPencil className="h-3 w-3" />
              {t("review.edit")}
            </span>
          </button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            onClick={startEdit}
          >
            <IconPencil className="mr-1 h-3.5 w-3.5" />
            {t("review.addReview")}
          </Button>
        )}
      </div>
    </section>
  )
}
