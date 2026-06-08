import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import {
  type SidebarGroupInput,
  getSidebarGroups,
  initializeDefaultSidebar,
  setSidebarGroups,
  toggleGroupCollapsed,
} from "@/database/sidebar"

export const dynamic = "force-dynamic"

export const GET = withHasPermission("bookList")(async (request) => {
  const user = request.auth.user
  await initializeDefaultSidebar(user.id)
  const groups = await getSidebarGroups(user.id)

  return NextResponse.json(groups)
})

export const PUT = withHasPermission("bookList")(async (request) => {
  const user = request.auth.user
  const body = (await request.json()) as SidebarGroupInput[]

  await setSidebarGroups(user.id, body)
  const groups = await getSidebarGroups(user.id)

  return NextResponse.json(groups)
})

export const PATCH = withHasPermission("bookList")(async (request) => {
  const body = (await request.json()) as {
    groupUuid: string
    collapsed: boolean
  }

  await toggleGroupCollapsed(body.groupUuid, body.collapsed)

  return NextResponse.json({ ok: true })
})
