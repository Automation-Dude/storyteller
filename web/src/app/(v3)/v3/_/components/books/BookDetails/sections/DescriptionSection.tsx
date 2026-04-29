import { useTranslations } from "next-intl"

import { useBookForm } from "@v3/_/components/books/BookDetails/BookFormProvider"
import { Label } from "@v3/_/components/ui/label"
import { Textarea } from "@v3/_/components/ui/textarea"

export function DescriptionSection({ className }: { className?: string }) {
  const { book, form, isEditing } = useBookForm()
  const t = useTranslations("BookDetailsPage")
  const tLabels = useTranslations("Labels")

  return (
    <section className={className}>
      {isEditing ? (
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="description"
            className="text-muted-foreground mb-2 font-sans text-xs font-medium tracking-wide uppercase"
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
          <h2 className="text-muted-foreground mb-2 font-sans text-xs font-medium tracking-wide uppercase">
            {tLabels("description")}
          </h2>

          <div
            className="prose prose-sm dark:prose-invert max-w-none text-xs"
            dangerouslySetInnerHTML={{ __html: book.description }}
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm italic">
          {t("noDescriptionAvailable")}
        </p>
      )}
    </section>
  )
}
