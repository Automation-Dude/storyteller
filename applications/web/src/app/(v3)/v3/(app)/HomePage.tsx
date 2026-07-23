"use client"

import { SiteHeader } from "@/app/(v3)/v3/_/components/site-header"
import {
  PageContent,
  PageLayout,
  PageMain,
} from "@/app/(v3)/v3/_/components/ui/page-layout"

import { HomeSections, HomeSectionsActions } from "./HomeSections"

export function HomePage() {
  return (
    <PageLayout>
      <PageMain>
        <SiteHeader
          breadcrumbs={[]}
          actions={<HomeSectionsActions />}
          className="absolute z-50 w-full bg-transparent!"
        />
        <PageContent>
          <HomeSections />
        </PageContent>
      </PageMain>
    </PageLayout>
  )
}
