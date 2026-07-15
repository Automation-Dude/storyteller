import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { getDistinctBookFieldValues } from "@/database/books"
import { isDistinctFacetField } from "@/fields"

/**
 * @summary List the distinct stored values of a distinct-facet book field
 * @desc '
 */
export const GET = withHasPermission("bookList")(async (request) => {
  const field = request.nextUrl.searchParams.get("field")

  if (!field || !isDistinctFacetField(field)) {
    return NextResponse.json(
      { message: `Unknown distinct field: ${field ?? ""}` },
      { status: 400 },
    )
  }

  const values = await getDistinctBookFieldValues(field)
  return NextResponse.json(values)
})
