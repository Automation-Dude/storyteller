import { cookies } from "next/headers"

import { AppSidebar } from "@v3/_/components/app-sidebar"
import { ProcessingToast } from "@v3/_/components/processing/ProcessingToast"
import { ThemeTweaksPanel } from "@v3/_/components/theme-tweaks/theme-tweaks-panel"
import { SidebarInset, SidebarProvider } from "@v3/_/components/ui/sidebar"
import { UserPreferencesProvider } from "@v3/_/components/user-preferences-provider"

import { assertAuthenticatedUser } from "@/auth/auth"
import { getSidebarGroups, initializeDefaultSidebar } from "@/database/sidebar"
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

  // resolve the sidebar config on the server so the nav is fully rendered on
  // first paint (no placeholder flash); the client query takes over for edits.
  await initializeDefaultSidebar(user.id)
  const sidebarGroups = await getSidebarGroups(user.id)

  // same server-resolve for preferences, so accent color + colorfulness apply
  // on first paint without a flash
  const preferences = resolveUserPreferences(await getUserSettings(user.id))

  // a custom accent color overrides the primary across the whole app (sidebar
  // included), the same way --sidebar-width is set here
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
            "--header-height": "calc(var(--spacing) * 13)",
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
        <ThemeTweaksPanel />
      </SidebarProvider>
    </UserPreferencesProvider>
  )
}
