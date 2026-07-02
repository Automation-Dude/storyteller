"use client"

import {
  IconAdjustmentsHorizontal,
  IconChevronRight,
  IconDotsVertical,
  IconEdit,
  IconEyeOff,
  IconSearch,
  IconSettings,
} from "@tabler/icons-react"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

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
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarPinButton,
} from "@v3/_/components/ui/sidebar"
import { Skeleton } from "@v3/_/components/ui/skeleton"
import { V3Link } from "@v3/_/components/v3-link"
import { useVersionBasePath } from "@v3/_/components/version-context"
import { useLibraryCounts } from "@v3/_/hooks/use-library-counts"
import { useTranslation } from "@v3/_/hooks/use-translation"

import type { User } from "@/apiModels"
import { cn } from "@/cn"
import { type ShelfWithBooks } from "@/database/shelves"
import {
  type SidebarGroupWithItems,
  type SidebarItemDetail,
} from "@/database/sidebar"
import { usePermission } from "@/hooks/usePermission"
import { usePermissions } from "@/hooks/usePermissions"
import {
  useGetLatestVersionQuery,
  useListSidebarGroupsQuery,
  useListUserShelvesQuery,
  useSetSidebarGroupsMutation,
  useToggleSidebarGroupCollapsedMutation,
} from "@/store/api"
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
import { ShelfEditor } from "./shelves/ShelfEditor"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { DynamicIcon } from "./ui/dynamic-icon"

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
  initialSidebarGroups,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: User
  currentVersion: string
  initialSidebarGroups: SidebarGroupWithItems[]
}) {
  const { data: sidebarGroups = initialSidebarGroups } =
    useListSidebarGroupsQuery()

  const libraryCounts = useLibraryCounts()
  const basePath = useVersionBasePath()
  const [editMode, setEditMode] = useState(false)
  const [editingShelfUuid, setEditingShelfUuid] = useState<string | null>(null)
  const [setSidebarGroupsMut] = useSetSidebarGroupsMutation()
  const canAccessSettings = usePermission("settingsUpdate")

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
    ...(canAccessSettings
      ? [
          {
            title: t("settings"),
            url: "/settings",
            icon: IconSettings,
            badge: hasUpdate ? <UpdateDot /> : undefined,
          },
        ]
      : []),
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

          <div className="flex items-center gap-0.5 group-data-[collapsible=icon]:hidden">
            <SidebarMenuButton
              size="sm"
              className="size-7 shrink-0"
              onClick={() => {
                setEditMode(true)
              }}
              tooltip={t("customize")}
            >
              <IconAdjustmentsHorizontal className="size-4" />
            </SidebarMenuButton>
            <SidebarPinButton />
          </div>
        </SidebarHeader>

        <SidebarContent>
          {editMode ? (
            <SidebarManager
              onClose={() => {
                setEditMode(false)
              }}
              groups={sidebarGroups}
            />
          ) : (
            <>
              {sidebarGroups.map((group) => (
                <SidebarNavGroup
                  key={group.uuid}
                  group={group}
                  libraryCounts={libraryCounts}
                  onEditShelf={(uuid) => {
                    setEditingShelfUuid(uuid)
                  }}
                  onRemoveItem={(itemUuid) => {
                    const updated = sidebarGroups.map((g) => ({
                      uuid: g.uuid,
                      name: g.name,
                      collapsed: g.collapsed,
                      items: g.items
                        .filter((i) => i.uuid !== itemUuid)
                        .map((i) => ({
                          kind: i.kind,
                          builtinKey: i.builtinKey,
                          collectionUuid: i.collectionUuid as
                            | string
                            | undefined,
                          shelfUuid: i.shelfUuid as string | undefined,
                          hidden: i.hidden,
                        })),
                    }))
                    void setSidebarGroupsMut(updated)
                  }}
                />
              ))}
              <NavSecondary items={navSecondary} className="mt-auto" />
            </>
          )}
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

      <ShelfEditorFromSidebar
        shelfUuid={editingShelfUuid}
        onClose={() => {
          setEditingShelfUuid(null)
        }}
      />
      <CommandSearch />
    </>
  )
}

function SidebarNavGroup({
  group,
  libraryCounts,
  onEditShelf,
  onRemoveItem,
}: {
  group: SidebarGroupWithItems
  libraryCounts: Record<
    string,
    { count: number | undefined; isLoading: boolean }
  >
  onEditShelf: (shelfUuid: string) => void
  onRemoveItem: (itemUuid: string) => void
}) {
  const t = useTranslation("AppSidebar")
  const tLibrary = useTranslation("LibraryPage")
  const permissions = usePermissions()
  const [toggleCollapsed] = useToggleSidebarGroupCollapsedMutation()
  const [localCollapsed, setLocalCollapsed] = useState(group.collapsed)

  const visibleItems = group.items.filter((item) => {
    if (item.hidden) return false
    // hide builtins the user lacks the permission for (e.g. alignment-quality).
    if (item.kind === "builtin" && item.builtinKey) {
      const builtin = BUILTIN_SIDEBAR_MAP[item.builtinKey]
      if (builtin?.permission && !permissions?.[builtin.permission])
        return false
    }
    return true
  })

  if (visibleItems.length === 0) return null

  const builtinTitle = (builtin: BuiltinSidebarItem) =>
    builtin.labelNs === "AppSidebar"
      ? t(builtin.labelKey)
      : tLibrary(builtin.labelKey)

  const renderItem = (item: SidebarItemDetail) => (
    <SidebarNavItem
      key={item.uuid}
      item={item}
      builtinTitle={builtinTitle}
      libraryCounts={libraryCounts}
      onEdit={
        item.kind === "shelf" && item.shelfUuid
          ? () => {
              onEditShelf(item.shelfUuid as string)
            }
          : undefined
      }
      onRemove={() => {
        onRemoveItem(item.uuid)
      }}
    />
  )

  // "Main" group renders without a collapsible header
  const isMainGroup = group.name === "Main"

  if (isMainGroup) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            {visibleItems.map(renderItem)}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <Collapsible
      open={!localCollapsed}
      onOpenChange={(open) => {
        setLocalCollapsed(!open)
        void toggleCollapsed({ groupUuid: group.uuid, collapsed: !open })
      }}
    >
      <SidebarGroup>
        <CollapsibleTrigger
          nativeButton={false}
          render={
            <SidebarGroupLabel className="section-label after:bg-muted-foreground cursor-pointer font-serif! text-xs font-medium normal-case italic opacity-60">
              <IconChevronRight
                className={cn(
                  "mr-1 size-3 transition-transform duration-200",
                  !localCollapsed && "rotate-90",
                )}
              />
              {group.name[0].toUpperCase() + group.name.slice(1)}
            </SidebarGroupLabel>
          }
        />

        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {visibleItems.map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

function SidebarNavItem({
  item,
  builtinTitle,
  libraryCounts,
  onEdit,
  onRemove,
}: {
  item: SidebarItemDetail
  builtinTitle: (builtin: BuiltinSidebarItem) => string
  libraryCounts: Record<
    string,
    { count: number | undefined; isLoading: boolean }
  >
  onEdit?: () => void
  onRemove?: () => void
}) {
  const location = usePathname()
  const basePath = useVersionBasePath()
  const normalizedLocation = basePath
    ? location.replace(basePath, "")
    : location

  const resolved = resolveItem(item, builtinTitle)
  if (!resolved) return null

  const isActive =
    normalizedLocation === resolved.url ||
    (resolved.url !== "/" && normalizedLocation.startsWith(resolved.url))

  const countResult = resolved.countKey
    ? libraryCounts[resolved.countKey]
    : null
  const count = countResult?.count
  const isCountLoading = countResult?.isLoading ?? false

  const isEntity = item.kind === "shelf" || item.kind === "collection"

  return (
    <SidebarMenuItem className="group/navitem">
      <SidebarMenuButton
        size="sm"
        isActive={isActive}
        render={
          <V3Link href={resolved.url}>
            {resolved.customIcon ? (
              <DynamicIcon
                iconId={resolved.customIcon}
                color={resolved.color}
                className="size-3.5! stroke-[1.5]"
              />
            ) : resolved.icon ? (
              <resolved.icon className="size-3.5! stroke-[1.5]" />
            ) : null}
            <span>{resolved.title}</span>
          </V3Link>
        }
      />

      {isEntity ? (
        <>
          <SidebarMenuBadge className="peer/ellipsis pointer-events-auto hidden group-hover/navitem:flex has-data-popup-open:flex">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="text-muted-foreground/50 hover:text-muted-foreground flex size-5 items-center justify-center rounded"
                  >
                    <IconDotsVertical className="size-3.5" />
                  </button>
                }
              />
              <DropdownMenuContent side="right" align="start">
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <IconEdit className="mr-2 size-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onRemove && (
                  <DropdownMenuItem onClick={onRemove}>
                    <IconEyeOff className="mr-2 size-4" />
                    Remove from sidebar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuBadge>

          <SidebarMenuBadge className="group-hover/navitem:hidden peer-has-data-popup-open/ellipsis:hidden">
            {count != null ? (
              count
            ) : isCountLoading ? (
              <Skeleton className="h-3.5 w-5 rounded" />
            ) : null}
          </SidebarMenuBadge>
        </>
      ) : (
        <>
          {count != null && <SidebarMenuBadge>{count}</SidebarMenuBadge>}

          {count == null && isCountLoading && resolved.countKey && (
            <SidebarMenuBadge>
              <Skeleton className="h-3.5 w-5 rounded" />
            </SidebarMenuBadge>
          )}
        </>
      )}
    </SidebarMenuItem>
  )
}

function ShelfEditorFromSidebar({
  shelfUuid,
  onClose,
}: {
  shelfUuid: string | null
  onClose: () => void
}) {
  const { data: rawShelves = [] } = useListUserShelvesQuery()

  // kysely inference loses selectAll fields; runtime data has all shelf columns
  const shelves = rawShelves as unknown as Array<
    ShelfWithBooks & { uuid: string }
  >

  const shelf = shelfUuid
    ? shelves.find((s) => s.uuid === shelfUuid) ?? null
    : null

  return (
    <ShelfEditor
      open={!!shelfUuid}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      shelf={shelf}
    />
  )
}

type ResolvedItem = {
  title: string
  url: string
  icon: React.ComponentType | null
  customIcon: string | null
  color: string | null
  countKey: string | null
}

function resolveItem(
  item: SidebarItemDetail,
  builtinTitle: (builtin: BuiltinSidebarItem) => string,
): ResolvedItem | null {
  if (item.kind === "builtin" && item.builtinKey) {
    const builtin = BUILTIN_SIDEBAR_MAP[item.builtinKey]
    if (!builtin) return null

    return {
      title: builtinTitle(builtin),
      url: builtin.href,
      icon: builtin.icon,
      customIcon: null,
      color: null,
      countKey: builtin.countKey ?? null,
    }
  }

  if (item.kind === "collection") {
    return {
      title: extractEmojiIcon(item.name ?? "").label || (item.name ?? ""),
      url: `/collections?item=${item.collectionUuid}`,
      icon: item.icon ? null : COLLECTION_ICON,
      customIcon: item.icon,
      color: item.color,
      countKey: `collection:${item.collectionUuid}`,
    }
  }

  if (item.kind === "shelf") {
    return {
      title: extractEmojiIcon(item.name ?? "").label || (item.name ?? ""),
      url: `/shelves/${item.shelfUuid}`,
      icon: item.icon ? null : SHELF_ICON,
      customIcon: item.icon,
      color: item.color,
      countKey: `shelf:${item.shelfUuid}`,
    }
  }

  return null
}
