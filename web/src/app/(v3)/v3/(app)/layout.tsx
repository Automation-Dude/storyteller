import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import { AppSidebar } from "@v3/_/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@v3/_/components/ui/sidebar"
import { UserPreferencesProvider } from "@v3/_/components/user-preferences-provider"

import { nextAuth } from "@/auth/auth"
import { getSidebarItems, initializeDefaultSidebar } from "@/database/sidebar"
import { resolveUserPreferences } from "@/database/userPreferencesTypes"
import { getUserSettings } from "@/database/userSettings"
import { logger } from "@/logging"
import { getCurrentVersion } from "@/versions"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // const user = await fetchApiRoute<User>("/user")
  const session = await nextAuth.auth()

  const cookieStore = await cookies()
  const currentVersion = getCurrentVersion()
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"

  if (!session) {
    // instrumentation for the spurious-logout investigation: record whether the
    // auth cookie was actually present when the session came back empty, to tell
    // "cookie missing" apart from "cookie present but session not resolved".
    logger.warn(
      {
        ctx: "auth-debug",
        hasToken: cookieStore.get("st_token")?.value != null,
        rewritten: (await headers()).get("x-v3-rewritten") === "1",
      },
      "v3 app layout: no session, redirecting to /login",
    )
    return redirect("/login")
  }

  // resolve the sidebar config on the server so the nav is fully rendered on
  // first paint (no placeholder flash); the client query takes over for edits.
  await initializeDefaultSidebar(session.user.id)
  const sidebarItems = await getSidebarItems(session.user.id)

  // same server-resolve for preferences, so accent color + colorfulness apply
  // on first paint without a flash
  const preferences = resolveUserPreferences(
    await getUserSettings(session.user.id),
  )

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
          user={session.user}
          className="absolute z-100"
          currentVersion={currentVersion}
          initialSidebarItems={sidebarItems}
        />
        <SidebarInset className="overflow-x-hidden">{children}</SidebarInset>
      </SidebarProvider>
    </UserPreferencesProvider>
  )
}
