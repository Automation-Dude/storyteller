"use client"

import { IconSearch, IconSettings } from "@tabler/icons-react"
import { useEffect, useMemo, useRef } from "react"
import { toast } from "sonner"

import {
  NavLibrary,
  type NavLibraryItem,
} from "@v3/_/components/nav/nav-library"
import { type NavItem, NavMain } from "@v3/_/components/nav/nav-main"
import {
  NavSecondary,
  type NavSecondaryItem,
} from "@v3/_/components/nav/nav-secondary"
import { NavUser } from "@v3/_/components/nav/nav-user"
import { Kbd, KbdGroup } from "@v3/_/components/ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarPinButton,
} from "@v3/_/components/ui/sidebar"
import { V3Link } from "@v3/_/components/v3-link"
import { useVersionBasePath } from "@v3/_/components/version-context"
import { useLibraryCounts } from "@v3/_/hooks/use-library-counts"
import { useTranslation } from "@v3/_/hooks/use-translation"

import type { User } from "@/apiModels"
import { type SidebarItemWithDetails } from "@/database/sidebar"
import { useGetLatestVersionQuery, useListSidebarQuery } from "@/store/api"
import { extractEmojiIcon } from "@/strings"
import { BETA_TAGS, compareVersions } from "@/versions"

import { CommandSearch, useCommandSearch } from "./command-search"
import { SidebarManager } from "./nav/SidebarManager"
import {
  BUILTIN_SIDEBAR_MAP,
  type BuiltinSidebarItem,
  COLLECTION_ICON,
  SHELF_ICON,
} from "./nav/sidebar-items"
import { DISMISSED_VERSION_KEY } from "./settings-form/changelog-tab"

const THIRTY_MINUTES = 30 * 60 * 1000

function UpdateDot() {
  return (
    <span
      className="bg-primary size-2 rounded-full"
      aria-label="Update available"
    />
  )
}

export function AppSidebar({
  user,
  currentVersion,
  initialSidebarItems,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: User
  currentVersion: string
  initialSidebarItems: SidebarItemWithDetails[]
}) {
  // seed with the server-resolved config so first paint is correct; the query
  // refetches in the background and supplies live updates after edits.
  const { data: sidebarItems = initialSidebarItems } = useListSidebarQuery()
  const libraryCounts = useLibraryCounts()
  const basePath = useVersionBasePath()

  const { data: latestVersionData } = useGetLatestVersionQuery(
    {
      component: "web",
      beta: BETA_TAGS.some((tag) => currentVersion.includes(tag)),
    },
    { pollingInterval: THIRTY_MINUTES },
  )

  const latestVersion = latestVersionData?.version ?? null

  const hasUpdate = useMemo(() => {
    if (!latestVersion) return false

    const dismissed =
      typeof window !== "undefined"
        ? localStorage.getItem(DISMISSED_VERSION_KEY)
        : null

    const isNewerThanCurrent = compareVersions(latestVersion, currentVersion)
    const isNewerThanDismissed =
      !dismissed || compareVersions(latestVersion, dismissed)

    return isNewerThanCurrent === 1 && isNewerThanDismissed
  }, [latestVersion, currentVersion])

  const toastShownRef = useRef(false)

  useEffect(() => {
    if (!hasUpdate || !latestVersion || toastShownRef.current) return

    toastShownRef.current = true

    toast.info(`A new version (v${latestVersion}) is available`, {
      dismissible: true,
      closeButton: true,
      onDismiss: () => {
        localStorage.setItem(DISMISSED_VERSION_KEY, latestVersion)
      },
      action: {
        label: "View changelog",
        onClick: () => {
          window.location.href = `${basePath}/settings?tab=changelog`
          localStorage.setItem(DISMISSED_VERSION_KEY, latestVersion)
        },
      },
      duration: Infinity,
    })
  }, [hasUpdate, latestVersion])

  const { openSearch } = useCommandSearch()

  const t = useTranslation("AppSidebar")
  const tLibrary = useTranslation("LibraryPage")

  // the sidebar nav is a per-user ordered config (sidebar_item table). builtins
  // resolve their icon/href/label from the registry; collection + shelf entries
  // carry their own uuid + live name. group placement comes from the registry
  // (entities render in the library group), so reordering is within-group.
  const builtinTitle = (builtin: BuiltinSidebarItem) =>
    builtin.labelNs === "AppSidebar"
      ? t(builtin.labelKey)
      : tLibrary(builtin.labelKey)

  const visibleItems = sidebarItems.filter((item) => !item.hidden)

  const navMain: NavItem[] = visibleItems.flatMap((item) => {
    if (item.kind !== "builtin" || item.builtinKey == null) return []
    const builtin = BUILTIN_SIDEBAR_MAP[item.builtinKey]
    if (!builtin || builtin.group !== "main") return []
    return [
      { title: builtinTitle(builtin), url: builtin.href, icon: builtin.icon },
    ]
  })

  const libraryNav: NavLibraryItem[] = visibleItems.flatMap(
    (item): NavLibraryItem[] => {
      if (item.kind === "builtin") {
        if (item.builtinKey == null) return []
        const builtin = BUILTIN_SIDEBAR_MAP[item.builtinKey]
        if (!builtin || builtin.group !== "library") return []
        return [
          {
            title: builtinTitle(builtin),
            url: builtin.href,
            icon: builtin.icon,
            countKey: builtin.countKey ?? builtin.key,
          },
        ]
      }

      if (item.kind === "collection") {
        return [
          {
            title: extractEmojiIcon(item.name ?? "").label || (item.name ?? ""),
            url: `/collections/${item.collectionUuid}`,
            icon: COLLECTION_ICON,
            // sentinel key (not in libraryCounts) so no badge renders
            countKey: `collection:${item.uuid}`,
          },
        ]
      }

      return [
        {
          title: extractEmojiIcon(item.name ?? "").label || (item.name ?? ""),
          url: `/shelves/${item.shelfUuid}`,
          icon: SHELF_ICON,
          countKey: `shelf:${item.uuid}`,
        },
      ]
    },
  )

  const navSecondary: NavSecondaryItem[] = [
    {
      custom: (
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={openSearch}
            className="flex justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <IconSearch />
              {t("search")}
            </div>
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ),
      key: "search",
    },
    {
      custom: <SidebarManager />,
      key: "customize-sidebar",
    },
    {
      title: t("settings"),
      url: "/settings",
      icon: IconSettings,
      badge: hasUpdate ? <UpdateDot /> : undefined,
    },
  ]

  return (
    <>
      <Sidebar variant="inset" collapsible="icon" {...props}>
        <SidebarHeader className="flex flex-row items-center justify-between gap-2">
          <V3Link
            href="/"
            className="hover:bg-sidebar-accent flex w-full items-center gap-2 rounded-md p-0"
          >
            <img
              loading="eager"
              src="/Storyteller_Logo.png"
              width={28}
              height={28}
              alt="Storyteller"
              className="h-7! max-h-7! w-7! max-w-7! shrink-0"
            />
            <span className="font-heading w-auto text-base opacity-100 group-data-[collapsible=icon]:hidden group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
              Storyteller
            </span>
          </V3Link>
          <SidebarPinButton className="group-data-[collapsible=icon]:hidden" />
        </SidebarHeader>
        <SidebarContent>
          <NavMain items={navMain} />
          <NavLibrary
            label={t("library")}
            items={libraryNav}
            counts={libraryCounts}
          />

          <NavSecondary items={navSecondary} className="mt-auto" />
        </SidebarContent>
        <SidebarFooter>
          <NavUser
            user={{
              name: user.name ?? null,
              email: user.email,
              username: user.username ?? null,
            }}
          />
        </SidebarFooter>
      </Sidebar>
      <CommandSearch />
    </>
  )
}
