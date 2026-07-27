import { NextResponse } from "next/server"

import { withKoreaderAuth } from "@/koreader/auth"

export const dynamic = "force-dynamic"

/**
 * @summary Verify a KOReader sync account
 * @desc kosync's GET /users/auth. The client only accepts 200 and 401; the
 *       body is ignored, it checks the status.
 */
export const GET = withKoreaderAuth(() =>
  NextResponse.json({ authorized: "OK" }, { status: 200 }),
)
