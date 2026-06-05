import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import {
  type SidebarItemInput,
  getSidebarItems,
  initializeDefaultSidebar,
  setSidebarItems,
} from "@/database/sidebar"

export const dynamic = "force-dynamic"

export const GET = withHasPermission("bookList")(async (request) => {
  const user = request.auth.user
  await initializeDefaultSidebar(user.id)
  const items = await getSidebarItems(user.id)

  return NextResponse.json(items)
})

export const PUT = withHasPermission("bookList")(async (request) => {
  const user = request.auth.user

  const body = (await request.json()) as SidebarItemInput[]

  await setSidebarItems(user.id, body)
  const items = await getSidebarItems(user.id)

  return NextResponse.json(items)
})
