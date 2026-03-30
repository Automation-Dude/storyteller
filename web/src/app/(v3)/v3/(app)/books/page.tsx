import { type Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { BookSelectionProvider } from "@/app/(v3)/v3/_/hooks/use-book-selection"
import { withPageAuth } from "@/app/(v3)/v3/_/server/page-auth-wrapper"

import BookPage from "./bookPage"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("BooksPage")
  return {
    title: t("title"),
  }
}

export default withPageAuth(["bookList"])((_, user) => {
  return (
    <BookSelectionProvider>
      <BookPage permissions={user.permissions!} />
    </BookSelectionProvider>
  )
})
