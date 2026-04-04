import { type Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { withPageAuth } from "@/app/(v3)/v3/_/server/page-auth-wrapper"

import { AuthorsPageClient } from "./authorsPageClient"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("LibraryPage")
  return {
    title: t("Authors.by"),
  }
}

export default withPageAuth(["bookList"])(() => {
  return <AuthorsPageClient />
})
