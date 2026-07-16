import { type Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { withPageAuth } from "@v3/_/server/page-auth-wrapper"

import { getTagByUuid } from "@/database/tags"
import { type UUID } from "@/uuid"

import { TagsPageClient } from "./tagsPageClient"

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ item?: UUID }>
}): Promise<Metadata> {
  const { item } = await searchParams
  const [t, tag] = await Promise.all([
    getTranslations("LibraryPage"),
    item ? getTagByUuid(item) : null,
  ])

  return {
    title: tag ? tag.name : t("Tags.by"),
  }
}

export default withPageAuth(["bookList"])(() => {
  return <TagsPageClient />
})
