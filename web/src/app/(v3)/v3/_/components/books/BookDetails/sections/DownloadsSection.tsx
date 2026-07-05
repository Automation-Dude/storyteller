"use client"

import * as icon from "@/icons"

import { Button } from "@v3/_/components/ui/button"
import { V3Link } from "@v3/_/components/v3-link"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { useBookForm } from "@/app/(v3)/v3/_/components/books/BookDetails/BookFormProvider"
import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { getDownloadUrl } from "@/store/api"

export function DownloadsSection({ className }: { className?: string }) {
  const { book } = useBookForm()
  const t = useTranslation("BookDetailsPage")
  const tLabels = useTranslation("Labels")

  return (
    <section className={className}>
      <h2 className="section-label mb-4">
        <icon.Download className="size-3.5 stroke-1" />
        {tLabels("downloads")}
      </h2>

      <div className="flex flex-wrap gap-3">
        {book.readaloud?.filepath && (
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <V3Link href={getDownloadUrl(book.uuid, "readaloud")}>
                <IconReadaloud className="text-st-orange-500 mr-2 h-4 w-4" />
                {t("downloads.downloadReadaloud")}
              </V3Link>
            }
          />
        )}

        {book.ebook && (
          <Button
            nativeButton={false}
            variant="outline"
            render={
              <V3Link href={getDownloadUrl(book.uuid, "ebook")}>
                <icon.BookAlt className="mr-2 h-4 w-4" />
                {t("downloads.downloadEbook")}
              </V3Link>
            }
          />
        )}

        {book.audiobook && (
          <Button
            nativeButton={false}
            variant="outline"
            render={
              <V3Link href={getDownloadUrl(book.uuid, "audiobook")}>
                <icon.Headphones className="mr-2 h-4 w-4" />
                {t("downloads.downloadAudiobook")}
              </V3Link>
            }
          />
        )}
      </div>
    </section>
  )
}
