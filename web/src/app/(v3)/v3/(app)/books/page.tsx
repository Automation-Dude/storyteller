import { type Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { BookSelectionProvider } from "@/app/(v3)/v3/_/hooks/use-book-selection"
import { nextAuth } from "@/auth/auth"

import BookPage from "./bookPage"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("BooksPage")
  return {
    title: t("title"),
  }
}

export default async function Books() {
  const session = await nextAuth.auth()

  if (!session) {
    redirect("/login")
  }

  return (
    <BookSelectionProvider>
      <BookPage permissions={session.user.permissions} />
    </BookSelectionProvider>
  )
}
