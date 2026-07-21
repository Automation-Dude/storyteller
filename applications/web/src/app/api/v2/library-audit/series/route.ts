import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { fetchWikidataSeriesParts } from "@/metadata/wikidata"

export const dynamic = "force-dynamic"

/**
 * @summary Name the volumes of a series
 * @desc Given a series name (and an author hint), returns the series' named,
 *       numbered volumes from Wikidata, so a gap the audit found by number
 *       ("missing #4") can be shown by title. Best-effort; an unknown series
 *       returns null parts. Admin only.
 */
export const POST = withHasPermission("settingsUpdate")(async (request) => {
  const body = (await request.json()) as { name?: unknown; author?: unknown }
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const author = typeof body.author === "string" ? body.author.trim() : null
  if (!name) {
    return NextResponse.json(
      { message: "No series name given" },
      { status: 400 },
    )
  }
  const result = await fetchWikidataSeriesParts(name, author)
  return NextResponse.json({ result })
})
