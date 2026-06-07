"use client"

import { type TablerIcon } from "@tabler/icons-react"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@v3/_/components/ui/sidebar"
import { Skeleton } from "@v3/_/components/ui/skeleton"
import { V3Link } from "@v3/_/components/v3-link"
import { useVersionBasePath } from "@v3/_/components/version-context"
import { type CountResult } from "@v3/_/hooks/use-library-counts"

export type NavLibraryItem = {
  title: string
  url: string
  icon?: TablerIcon
  countKey: string
}

export function NavLibrary({
  label,
  items,
  counts,
}: {
  label: string
  items: NavLibraryItem[]
  counts: Record<string, CountResult>
}) {
  const location = usePathname()
  const basePath = useVersionBasePath()
  const normalizedLocation = basePath
    ? location.replace(basePath, "")
    : location

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="font-sans text-[10px] font-medium tracking-[0.14em] uppercase opacity-60">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map((item) => {
            const isActive =
              normalizedLocation === item.url ||
              (item.url !== "/" && normalizedLocation.startsWith(item.url))

            const countResult = counts[item.countKey]
            const count = countResult?.count
            const isCountLoading = countResult?.isLoading ?? true

            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  size="sm"
                  isActive={isActive}
                  render={
                    <V3Link href={item.url}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </V3Link>
                  }
                />

                {count != null && <SidebarMenuBadge>{count}</SidebarMenuBadge>}

                {count == null && isCountLoading && (
                  <SidebarMenuBadge>
                    <Skeleton className="h-3.5 w-5 rounded" />
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
