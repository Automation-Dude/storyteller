"use client"

import { IconBook, IconDownload, IconHeadphones } from "@tabler/icons-react"
import { useTranslations } from "next-intl"

import { IconReadaloud } from "@/components/icons/IconReadaloud"
import { getDownloadUrl } from "@/store/api"

import { Button } from "@v3/_/components/ui/button"
import { V3Link } from "@v3/_/components/v3-link"

import { useBookForm } from "../BookFormProvider"

export function DownloadsSection({ className }: { className?: string }) {
  const { book } = useBookForm()
  const t = useTranslations("BookDetailsPage")
  const tLabels = useTranslations("Labels")

  return (
    <section className={className}>
      <h2 className="section-label mb-4">
        <IconDownload className="h-4 w-4" />
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
                <IconBook className="mr-2 h-4 w-4" />
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
                <IconHeadphones className="mr-2 h-4 w-4" />
                {t("downloads.downloadAudiobook")}
              </V3Link>
            }
          />
        )}
      </div>
    </section>
  )
}
