"use client"

import { Fragment, type ReactNode } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@v3/_/components/ui/breadcrumb"
import { SidebarTrigger } from "@v3/_/components/ui/sidebar"
import { V3Link } from "@v3/_/components/v3-link"

import { cn } from "@/cn"

export function SiteHeader({
  breadcrumbs,
  actions,
  className,
}: {
  breadcrumbs: ({ label: string; url?: string } | { render: ReactNode })[]
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "bg-background sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)",
        className,
      )}
    >
      <div className="flex w-full min-w-0 items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <>
          {/* Mobile only */}
          <SidebarTrigger className="-ml-1 block shrink-0 md:hidden" />
        </>
        <Breadcrumb className="min-w-0 shrink-0">
          <BreadcrumbList className="flex-nowrap">
            {breadcrumbs.map((breadcrumb, idx) => (
              <Fragment
                key={
                  "render" in breadcrumb
                    ? idx
                    : (breadcrumb.url ?? breadcrumb.label)
                }
              >
                <BreadcrumbItem className="min-w-0">
                  {"render" in breadcrumb ? (
                    breadcrumb.render
                  ) : (
                    <>
                      {breadcrumb.url ? (
                        <BreadcrumbLink
                          href={breadcrumb.url}
                          className="truncate"
                          render={
                            <V3Link href={breadcrumb.url}>
                              {breadcrumb.label}
                            </V3Link>
                          }
                        />
                      ) : idx === breadcrumbs.length - 1 ? (
                        <h1 className="min-w-0">
                          <BreadcrumbPage className="font-heading font-tracking-tight truncate font-normal uppercase">
                            {breadcrumb.label}
                          </BreadcrumbPage>
                        </h1>
                      ) : (
                        <BreadcrumbPage className="truncate">
                          {breadcrumb.label}
                        </BreadcrumbPage>
                      )}
                    </>
                  )}
                </BreadcrumbItem>
                {idx < breadcrumbs.length - 1 && (
                  <BreadcrumbSeparator className="shrink-0" />
                )}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        {actions && (
          <div className="ml-auto flex min-w-0 flex-1 justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
