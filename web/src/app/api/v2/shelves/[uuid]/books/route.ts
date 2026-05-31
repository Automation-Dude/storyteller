import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import {
  addBooksToShelf,
  removeBooksFromShelf,
  getShelfBooks,
  type GetShelfBooksOptions,
} from "@/database/shelves"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

type Params = Promise<{ uuid: UUID }>

export const GET = withHasPermission<Params>("bookList")(async (
  request,
  context,
) => {
  const user = request.auth.user
  const { uuid } = await context.params

  const limitParam = request.nextUrl.searchParams.get("limit")
  const offsetParam = request.nextUrl.searchParams.get("offset")
  const orderByParam = request.nextUrl.searchParams.get("orderBy")
  const orderDirectionParam = request.nextUrl.searchParams.get("orderDirection")

  const opts: GetShelfBooksOptions = {}

  if (limitParam) {
    opts.limit = parseInt(limitParam)
  }

  if (offsetParam) {
    opts.offset = parseInt(offsetParam)
  }

  if (orderByParam) {
    opts.orderBy = orderByParam as GetShelfBooksOptions["orderBy"]
  }

  if (orderDirectionParam) {
    opts.orderDirection = orderDirectionParam as "asc" | "desc"
  }

  const books = await getShelfBooks(uuid, user.id, opts)

  return NextResponse.json(books)
})

export const POST = withHasPermission<Params>("bookList")(async (
  request,
  context,
) => {
  const user = request.auth.user
  const { uuid } = await context.params
  const body = (await request.json()) as { books: UUID[] }

  await addBooksToShelf(uuid, user.id, body.books)

  return new Response(null, { status: 204 })
})

export const DELETE = withHasPermission<Params>("bookList")(async (
  request,
  context,
) => {
  const user = request.auth.user
  const { uuid } = await context.params
  const body = (await request.json()) as { books: UUID[] }

  await removeBooksFromShelf(uuid, user.id, body.books)

  return new Response(null, { status: 204 })
})
