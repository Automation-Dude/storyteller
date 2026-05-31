import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { SiteHeader } from "@v3/_/components/site-header"

import { HomeShelves, HomeShelvesActions } from "./HomeShelves"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("HomePage")
  return {
    title: t("title"),
  }
}

export default async function Index() {
  const t = await getTranslations("HomePage")

  return (
    <div>
      <SiteHeader
        breadcrumbs={[{ label: t("title") }]}
        actions={<HomeShelvesActions />}
      />
      <HomeShelves />
    </div>
  )
}
