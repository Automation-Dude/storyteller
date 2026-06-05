import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AppSidebar } from "@v3/_/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@v3/_/components/ui/sidebar"

import { nextAuth } from "@/auth/auth"
import { getSidebarItems, initializeDefaultSidebar } from "@/database/sidebar"
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
    return redirect("/login")
  }

  // resolve the sidebar config on the server so the nav is fully rendered on
  // first paint (no placeholder flash); the client query takes over for edits.
  await initializeDefaultSidebar(session.user.id)
  const sidebarItems = await getSidebarItems(session.user.id)

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="z-50"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 56)",
          "--header-height": "calc(var(--spacing) * 13)",
          // "--sidebar-width-icon": "calc(var(--spacing) * 11)",
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
  )
}
