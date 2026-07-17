import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import {
  getHomeSections,
  removeHomeSection,
  setHomeSectionEnabled,
} from "@/database/shelves"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

type Params = Promise<{ uuid: UUID }>

export const DELETE = withHasPermission<Params>("bookList")(async (
  request,
  context,
) => {
  const user = request.auth.user
  const { uuid } = await context.params
  await removeHomeSection(uuid, user.id)

  return new Response(null, { status: 204 })
})

export const PATCH = withHasPermission<Params>("bookList")(async (
  request,
  context,
) => {
  const user = request.auth.user
  const { uuid } = await context.params
  const { enabled } = (await request.json()) as { enabled: boolean }

  await setHomeSectionEnabled(uuid, user.id, enabled)
  const sections = await getHomeSections(user.id)
  const updated = sections.find((hs) => hs.uuid === uuid)

  if (!updated) {
    return new Response(null, { status: 404 })
  }

  return NextResponse.json(updated)
})
