import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { createShelf, getShelves } from "@/database/shelves"
import { type ShelfFilter } from "@/database/shelfFilter"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

export const GET = withHasPermission("bookList")(async (request) => {
  const user = request.auth.user
  const shelves = await getShelves(user.id)

  return NextResponse.json(shelves)
})

export const POST = withHasPermission("bookList")(async (request) => {
  const user = request.auth.user

  const body = (await request.json()) as {
    name: string
    description?: string | null
    filter?: ShelfFilter | null
    orderBy?: string | null
    orderDirection?: "asc" | "desc" | null
    limitCount?: number | null
    books?: UUID[]
  }

  const shelf = await createShelf(
    user.id,
    {
      name: body.name,
      description: body.description ?? null,
      filter: body.filter ? JSON.stringify(body.filter) : null,
      orderBy: body.orderBy ?? "createdAt",
      orderDirection: body.orderDirection ?? "desc",
      limitCount: body.limitCount ?? null,
    },
    body.books,
  )

  return NextResponse.json(shelf)
})
