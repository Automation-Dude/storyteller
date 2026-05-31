import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { booksQuery } from "@/database/books"
import {
  type ShelfFilter,
  buildFilterExpression,
} from "@/database/shelfFilter"

export const dynamic = "force-dynamic"

export const POST = withHasPermission("bookList")(async (request) => {
  const user = request.auth.user

  const body = (await request.json()) as {
    filter: ShelfFilter | null
    orderBy?: string
    orderDirection?: "asc" | "desc"
    limit?: number
  }

  if (!body.filter) {
    return NextResponse.json([])
  }

  let query = booksQuery(user.id)

  query = query.where((eb) => buildFilterExpression(eb, body.filter!, user.id))

  const limit = body.limit ?? 20
  query = query.limit(limit)

  const orderBy = body.orderBy ?? "createdAt"
  const orderDirection = body.orderDirection ?? "desc"
  query = query.orderBy(`book.${orderBy}`, orderDirection)

  const books = await query.execute()

  return NextResponse.json(books)
})
