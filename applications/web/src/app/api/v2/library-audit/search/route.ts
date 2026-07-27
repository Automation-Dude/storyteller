import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { searchOpenLibrary } from "@/metadata/openLibrary"

export const dynamic = "force-dynamic"

/**
 * @summary Search Open Library by hand
 * @desc Backs the manual lookup on the audit page: a person types a title (and
 *       optionally an author) and gets candidates to copy from. Admin only.
 */
export const GET = withHasPermission("settingsUpdate")(async (request) => {
  const url = new URL(request.url)
  const query = url.searchParams.get("q")?.trim()
  const author = url.searchParams.get("author")?.trim() || undefined
  if (!query) {
    return NextResponse.json({ candidates: [] })
  }
  const candidates = await searchOpenLibrary(query, author, 8)
  return NextResponse.json({ candidates })
})
