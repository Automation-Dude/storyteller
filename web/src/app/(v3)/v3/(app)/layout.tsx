import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { nextAuth } from "@/auth/auth"
import { getCurrentVersion } from "@/versions"

import { AppSidebar } from "@v3/_/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@v3/_/components/ui/sidebar"

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

  // usersettings

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="z-50 font-serif"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 56)",
          "--header-height": "calc(var(--spacing) * 13)",
          "--sidebar-width-icon": "calc(var(--spacing) * 10)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        user={session.user}
        className="absolute z-100"
        currentVersion={currentVersion}
      />
      <SidebarInset className="overflow-x-hidden">{children}</SidebarInset>
    </SidebarProvider>
  )
}
