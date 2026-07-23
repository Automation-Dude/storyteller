import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { getSectionFacets, isFacetSection } from "@/database/libraryCounts"

export const dynamic = "force-dynamic"

/**
 * @summary Library section facet list
 * @desc 'The facet list (series, authors, tags, ...) plus per-facet book counts
 * for a single library section
 * Pass the section via the `section` query param.'
 */
export const GET = withHasPermission("bookList")(async (request) => {
  const section = request.nextUrl.searchParams.get("section")

  if (!section || !isFacetSection(section)) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 })
  }

  const facets = await getSectionFacets(request.auth.user.id, section)

  return NextResponse.json(facets)
})
