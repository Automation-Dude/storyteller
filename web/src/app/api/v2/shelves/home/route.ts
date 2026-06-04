import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import {
  type HomeShelfType,
  addHomeShelf,
  getHomeShelves,
  initializeDefaultHomeShelves,
  setHomeShelves,
} from "@/database/shelves"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

export const GET = withHasPermission("bookList")(async (request) => {
  const user = request.auth.user
  await initializeDefaultHomeShelves(user.id)
  const homeShelves = await getHomeShelves(user.id)

  return NextResponse.json(homeShelves)
})

export const PUT = withHasPermission("bookList")(async (request) => {
  const user = request.auth.user

  const body = (await request.json()) as Array<{
    shelfUuid?: UUID | null
    shelfType: HomeShelfType
  }>

  await setHomeShelves(user.id, body)
  const homeShelves = await getHomeShelves(user.id)

  return NextResponse.json(homeShelves)
})

export const POST = withHasPermission("bookList")(async (request) => {
  const user = request.auth.user

  const body = (await request.json()) as {
    shelfUuid?: UUID | null
    shelfType: HomeShelfType
  }

  const uuid = await addHomeShelf(user.id, body)
  const homeShelves = await getHomeShelves(user.id)
  const newShelf = homeShelves.find((hs) => hs.uuid === uuid)

  return NextResponse.json(newShelf)
})
