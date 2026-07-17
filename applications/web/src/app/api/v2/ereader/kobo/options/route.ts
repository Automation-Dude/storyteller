import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { getCollections } from "@/database/collections"
import { getUsers } from "@/database/users"

export const dynamic = "force-dynamic"

/**
 * @summary Who an e-reader can be set up for, and what shelf it can be given
 * @desc Everything the setup page needs to ask the two questions that decide
 *       whether a device is configured correctly: whose reading place this is,
 *       and which books they get. Without the first, a reader's progress ends
 *       up in someone else's library.
 */
export const GET = withHasPermission("bookDownload")(async (request) => {
  const caller = request.auth.user

  // Only someone who may see the accounts is offered other people to set up
  // for; everyone else can still set up their own device.
  const canSetUpForOthers = Boolean(caller.permissions?.userList)

  const users = canSetUpForOthers
    ? (await getUsers()).map((user) => ({
        id: user.id,
        // Some accounts are invite-only and have no username yet.
        name: user.username || user.email,
      }))
    : [{ id: caller.id, name: caller.username || caller.email }]

  const collections = await getCollections(caller.id)

  return NextResponse.json({
    canSetUpForOthers,
    users,
    // Null shelf means the whole library, which is the default.
    shelves: collections.map((collection) => ({
      uuid: collection.uuid,
      name: collection.name,
    })),
  })
})
