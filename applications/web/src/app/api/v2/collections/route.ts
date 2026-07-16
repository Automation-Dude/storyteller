import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { createCollection, getCollections } from "@/database/collections"
import { type UUID } from "@/uuid"

/**
 * @summary List all collections
 * @desc '
 */
export const GET = withHasPermission("bookList")(async (request) => {
  const user = request.auth.user
  const { searchParams } = new URL(request.url)
  const order = searchParams.get("order") === "desc" ? "desc" : "asc"
  const limit = searchParams.get("limit")
  const collections = await getCollections(user.id, {
    order,
    ...(limit && { limit: Number(limit) }),
  })

  return NextResponse.json(collections)
})

export const POST = withHasPermission("collectionCreate")(async (request) => {
  const { users, ...values } = (await request.json()) as {
    name: string
    description: string
    public: boolean
    users?: UUID[]
  }

  const created = await createCollection(values, {
    users: [...(users ?? []), request.auth.user.id],
  })

  // the sidebar picks the new collection up via ensureSidebarDefaults on its
  // next read (the client invalidates the Sidebar tag after this mutation)
  return NextResponse.json(created)
})
