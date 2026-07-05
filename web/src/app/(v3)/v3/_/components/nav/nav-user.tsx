"use client"

import * as icon from "@/icons"
import Link from "next/link"
import { useTheme } from "next-themes"

import { LocaleChanger } from "@v3/_/components/locale-changer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@v3/_/components/ui/sidebar"
import { useVersionBasePath } from "@v3/_/components/version-context"
import { useTranslation } from "@v3/_/hooks/use-translation"

export function NavUser({
  user,
}: {
  user: {
    name: string | null
    email: string | null
    username: string | null
  }
}) {
  const { isMobile } = useSidebar()
  const { setTheme, theme } = useTheme()
  const basePath = useVersionBasePath()

  const displayName = user.name ?? user.username ?? "User"

  const t = useTranslation("AppSidebar")

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="default"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:p-1!"
              >
                <div className="grid w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden data-[state=open]:w-auto">
                  <span className="truncate font-medium">{displayName}</span>
                  {user.name && (
                    <span className="text-sidebar-foreground/60 truncate font-sans text-xs">
                      {user.username}
                    </span>
                  )}
                </div>
                <icon.DotsVertical className="size-4 data-[collapsible=icon]:-ml-4!" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent
            className="z-0 min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            // sidebar is obscuring it
            sideOffset={12}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{displayName}</span>

                    {user.username && (
                      <span className="text-muted-foreground truncate text-xs">
                        {user.username}
                      </span>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                render={
                  <Link
                    href={`${basePath}/preferences`}
                    className="flex items-center gap-2"
                  >
                    <icon.User />
                    {t("account")}
                  </Link>
                }
              />
              <DropdownMenuItem
                render={
                  <Link
                    href={`${basePath}/preferences?tab=general`}
                    className="flex items-center gap-2"
                  >
                    <icon.Settings2 />
                    {t("preferences")}
                  </Link>
                }
              />

              <DropdownMenuItem
                onClick={() => {
                  document.cookie =
                    "frontend-version=v2; path=/; max-age=31536000"
                  window.location.href = "/"
                }}
              >
                <icon.ArrowBack />
                {t("switchToClassic")}
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href="https://storyteller-platform.gitlab.io/storyteller/"
                    className="flex items-center gap-2"
                  >
                    <icon.HelpCircle />
                    {t("documentation")}
                  </Link>
                }
              />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {theme === "dark" ? (
                    <icon.Moon className="size-4" />
                  ) : (
                    <icon.Sun className="size-4" />
                  )}
                  {t("theme")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={() => {
                      setTheme("light")
                    }}
                  >
                    <icon.Sun className="size-4" />
                    {t("light")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setTheme("dark")
                    }}
                  >
                    <icon.Moon className="size-4" />
                    {t("dark")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setTheme("system")
                    }}
                  >
                    {t("system")}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <LocaleChanger nested />
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <Link
                  href={`/logout?redirectTo=${encodeURIComponent(`${basePath}/login`)}`}
                  // lmao this would log you out otherwise
                  prefetch={false}
                  className="flex items-center gap-2"
                >
                  <icon.Logout />
                  {t("logout")}
                </Link>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
