import { useTranslations } from "next-intl"
import router from "next/router"
import { useState } from "react"

import { type BookWithRelations } from "@/database/books"
import { useDeleteBookMutation } from "@/store/api"

import { Button } from "@v3/_/components/ui/button"
import { Dialog, DialogContent } from "@v3/_/components/ui/dialog"
import { Separator } from "@v3/_/components/ui/separator"

export function DeleteBookModal({
  canDelete,
  book,
}: {
  canDelete: boolean
  book: BookWithRelations
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteAssetMode, setDeleteAssetMode] = useState<
    "" | "internal" | "all"
  >("")
  const t = useTranslations("BookDetailsPage")
  const [deleteBook] = useDeleteBookMutation()

  if (!canDelete) {
    return null
  }

  return (
    <>
      <Separator className="my-8" />
      <section className="mb-8">
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <div className="flex flex-col gap-4 p-6">
              <h3 className="text-lg font-semibold">{t("deleteBook")}</h3>

              <p className="text-muted-foreground text-sm">
                Are you sure you want to delete{" "}
                <strong className="text-foreground">{book.title}</strong>
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
                      onChange={() => {
                        setDeleteAssetMode(option.value)
                      }}
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
                  onClick={() => {
                    setShowDeleteDialog(false)
                  }}
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
  )
}
