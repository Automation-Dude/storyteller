"use client"

import { SiteHeader } from "../_/components/site-header"
import {
  PageContent,
  PageHeader,
  PageLayout,
  PageMain,
} from "../_/components/ui/page-layout"

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
