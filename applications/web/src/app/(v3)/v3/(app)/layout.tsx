import { cookies } from "next/headers"

import { AnnouncementModal } from "@v3/_/components/announcements/announcement-modal"
import { AppSidebar } from "@v3/_/components/app-sidebar"
import { ProcessingToast } from "@v3/_/components/processing/ProcessingToast"
import { SidebarInset, SidebarProvider } from "@v3/_/components/ui/sidebar"
import { UserPreferencesProvider } from "@v3/_/components/user-preferences-provider"

import { assertAuthenticatedUser } from "@/auth/auth"
import { getPendingAnnouncements } from "@/database/announcements"
import { ensureSidebarDefaults, getSidebarGroups } from "@/database/sidebar"
import { resolveUserPreferences } from "@/database/userPreferencesTypes"
import { getUserSettings } from "@/database/userSettings"
import { getCurrentVersion } from "@/versions"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // redirects to /login when there is no valid session
  const user = await assertAuthenticatedUser()

  const cookieStore = await cookies()
  const currentVersion = getCurrentVersion()
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"

  await ensureSidebarDefaults(user.id)
  const sidebarGroups = await getSidebarGroups(user.id)

  const preferences = resolveUserPreferences(await getUserSettings(user.id))

  const pendingAnnouncements = await getPendingAnnouncements(user.id)

  const accentStyle: React.CSSProperties = preferences.accentColor
    ? ({
        "--primary": preferences.accentColor,
        "--sidebar-primary": preferences.accentColor,
      } as React.CSSProperties)
    : {}

  return (
    <UserPreferencesProvider initialPreferences={preferences}>
      <SidebarProvider
        defaultOpen={defaultOpen}
        className="z-50"
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 56)",
            // one shared 56px header line across every panel's header row
            "--header-height": "calc(var(--spacing) * 14)",
            // "--sidebar-width-icon": "calc(var(--spacing) * 11)",
            ...accentStyle,
          } as React.CSSProperties
        }
      >
        <AppSidebar
          variant="inset"
          user={user}
          className="absolute z-40"
          currentVersion={currentVersion}
          initialSidebarGroups={sidebarGroups}
        />
        <SidebarInset className="overflow-x-hidden">{children}</SidebarInset>
        {user.permissions.bookProcess && <ProcessingToast />}
        <AnnouncementModal pending={pendingAnnouncements} />
        {/* <ThemeTweaksPanel /> */}
      </SidebarProvider>
    </UserPreferencesProvider>
  )
}
