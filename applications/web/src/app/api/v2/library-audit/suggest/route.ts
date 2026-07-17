import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { proposeForBooks } from "@/metadata/repair"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

/**
 * @summary Propose Open Library matches for flagged books
 * @desc Given a list of book ids, looks each up and returns scored matches to
 *       review. Admin only. Sent in batches by the audit page so a large
 *       library can show progress rather than one long request.
 */
export const POST = withHasPermission("settingsUpdate")(async (request) => {
  const body = (await request.json()) as { bookUuids?: unknown }
  const bookUuids = Array.isArray(body.bookUuids)
    ? (body.bookUuids.filter((id) => typeof id === "string") as UUID[])
    : []
  if (bookUuids.length === 0) {
    return NextResponse.json({ message: "No books given" }, { status: 400 })
  }
  // Cap a single request so one call cannot fan out to hundreds of lookups.
  if (bookUuids.length > 50) {
    return NextResponse.json(
      { message: "Too many books in one request (max 50)" },
      { status: 400 },
    )
  }

  const proposals = await proposeForBooks(bookUuids, request.auth.user.id)
  return NextResponse.json({ proposals })
})
