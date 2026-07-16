import { withHasPermission } from "@/auth/auth"
import {
  type CreatorUpdate,
  deleteCreator,
  updateCreator,
} from "@/database/creators"
import { type UUID } from "@/uuid"

type Params = Promise<{ uuid: UUID }>

export const PUT = withHasPermission<Params>("bookUpdate")(async (
  request,
  context,
) => {
  const { uuid } = await context.params
  const update = (await request.json()) as CreatorUpdate

  const updated = await updateCreator(uuid, update)
  return Response.json(updated)
})

export const DELETE = withHasPermission<Params>("bookUpdate")(async (
  _request,
  context,
) => {
  const { uuid } = await context.params
  await deleteCreator(uuid)
  return new Response(null, { status: 204 })
})
