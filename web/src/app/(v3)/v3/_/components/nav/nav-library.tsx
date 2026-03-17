"use client"

import { type TablerIcon } from "@tabler/icons-react"
import { usePathname } from "next/navigation"

import { type CountResult } from "@v3/_/hooks/use-library-counts"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@v3/_/components/ui/sidebar"
import { V3Link } from "@v3/_/components/v3-link"

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
  const locationWithoutV3 = location.replace(/v3\/?/, "")

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map((item) => {
            const isActive =
              locationWithoutV3 === item.url ||
              (item.url !== "/" && locationWithoutV3.startsWith(item.url))

            const countResult = counts[item.countKey]
            const count = countResult?.count

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
                {count != null && (
                  <SidebarMenuBadge>{count}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
