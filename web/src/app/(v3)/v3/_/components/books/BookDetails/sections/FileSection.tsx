"use client"
import { IconFileText } from "@tabler/icons-react"
import { useTranslations } from "next-intl"

import { cn } from "@/cn"
import { type BookWithRelations } from "@/database/books"

import { useFormatDate } from "@v3/_/lib/date"

import { FilePathRow } from "../FilePathRow"

export function FileSection({
  book,
  className,
}: {
  book: BookWithRelations
  className?: string
}) {
  const t = useTranslations("BookDetailsPage")
  const formatDate = useFormatDate()

  return (
    <section className={cn(className)}>
      <h2 className="section-label mb-4">
        <IconFileText className="h-4 w-4" />
        {t("fileInformation.title")}
      </h2>
      <div className="space-y-3">
        {book.readaloud?.filepath && (
          <FilePathRow
            label={t("fileInformation.readaloud")}
            filepath={book.readaloud.filepath}
            missing={book.readaloud.missing}
          />
        )}

        {book.ebook && (
          <FilePathRow
            label={t("fileInformation.ebook")}
            filepath={book.ebook.filepath}
            missing={book.ebook.missing}
          />
        )}

        {book.audiobook && (
          <FilePathRow
            label={t("fileInformation.audiobook")}
            filepath={book.audiobook.filepath}
            missing={book.audiobook.missing}
          />
        )}

        {book.alignedAt && (
          <FilePathRow
            label={t("fileInformation.lastAligned")}
            filepath={formatDate(book.alignedAt)}
            missing={false}
          />
        )}

        {book.alignedWith && (
          <FilePathRow
            label={t("fileInformation.transcriptionEngine")}
            filepath={book.alignedWith}
            missing={false}
          />
        )}

        {book.alignedByStorytellerVersion && (
          <FilePathRow
            label={t("fileInformation.storytellerVersion")}
            filepath={book.alignedByStorytellerVersion}
            missing={false}
          />
        )}
      </div>
    </section>
  )
}
