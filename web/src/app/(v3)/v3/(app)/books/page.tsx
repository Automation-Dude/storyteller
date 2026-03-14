import { type Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { BookSelectionProvider } from "@/app/(v3)/v3/_/hooks/use-book-selection"

import BookPage from "./bookPage"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("BooksPage")
  return {
    title: t("title"),
  }
}

export default function Books() {
  return (
    <BookSelectionProvider>
      <BookPage />
    </BookSelectionProvider>
  )
}
