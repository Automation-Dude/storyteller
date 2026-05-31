import { withHasPermission } from "@/auth/auth"
import { removeHomeShelf } from "@/database/shelves"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

type Params = Promise<{ uuid: UUID }>

export const DELETE = withHasPermission<Params>("bookList")(async (
  request,
  context,
) => {
  const user = request.auth.user
  const { uuid } = await context.params
  await removeHomeShelf(uuid, user.id)

  return new Response(null, { status: 204 })
})
