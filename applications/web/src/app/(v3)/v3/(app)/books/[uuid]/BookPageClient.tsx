"use client"

import { type BookWithRelations } from "@/database/books"
import { type UUID } from "@/uuid"

import { BookDetailsContent } from "../../../_/components/books/BookDetails/BookDetailsPage"
import { useClaimBookPanel } from "../../../_/components/books/FloatingBookPanel"

export function BookPageClient({
  uuid,
  assetsDir,
  initialBook,
}: {
  uuid: UUID
  assetsDir: string
  initialBook: BookWithRelations
}) {
  useClaimBookPanel()

  return (
    <BookDetailsContent
      uuid={uuid}
      assetsDir={assetsDir}
      initialBook={initialBook}
    />
  )
}
