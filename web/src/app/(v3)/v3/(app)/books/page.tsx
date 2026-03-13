import { type Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { ScrollArea } from "@/app/(v3)/v3/_/components/ui/scroll-area"
import { BookSelectionProvider } from "@/app/(v3)/v3/_/hooks/use-book-selection"

import { SiteHeader } from "@v3/_/components/site-header"

import BookPage from "./bookPage"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("BooksPage")
  return {
    title: t("title"),
  }
}

export default async function Books() {
  const t = await getTranslations("BooksPage")
  return (
    <>
      <SiteHeader breadcrumbs={[{ label: t("title") }]} />
      <ScrollArea className="flex max-h-svh flex-1 flex-col">
        <BookSelectionProvider>
          <BookPage />
        </BookSelectionProvider>
      </ScrollArea>
    </>
  )
}
