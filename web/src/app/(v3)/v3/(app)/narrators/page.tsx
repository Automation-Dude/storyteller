import { type Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { withPageAuth } from "@/app/(v3)/v3/_/server/page-auth-wrapper"

import { NarratorsPageClient } from "./narratorsPageClient"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("LibraryPage")
  return {
    title: t("Narrators.by"),
  }
}

export default withPageAuth(["bookList"])(() => {
  return <NarratorsPageClient />
})
