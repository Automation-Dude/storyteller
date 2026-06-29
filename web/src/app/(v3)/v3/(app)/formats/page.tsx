import { type Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { withPageAuth } from "@v3/_/server/page-auth-wrapper"

import { FormatsPageClient } from "./formatsPageClient"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("LibraryPage")
  return {
    title: t("Formats.by"),
  }
}

export default withPageAuth(["bookList"])(() => {
  return <FormatsPageClient />
})
