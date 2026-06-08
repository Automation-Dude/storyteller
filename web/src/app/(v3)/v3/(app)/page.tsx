import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { SiteHeader } from "@v3/_/components/site-header"

import { HomeSections, HomeSectionsActions } from "./HomeSections"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("HomePage")
  return {
    title: t("title"),
  }
}

export default function Index() {
  return (
    <div className="scroll-y relative">
      <SiteHeader
        breadcrumbs={[]}
        actions={<HomeSectionsActions />}
        className="bg-transparent"
      />
      <HomeSections />
    </div>
  )
}
