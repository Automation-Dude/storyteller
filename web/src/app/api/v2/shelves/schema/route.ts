import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { generateShelfFilterJsonSchema } from "@/database/shelfFilter.schema"

export const dynamic = "force-dynamic"

export const GET = withHasPermission("bookList")(async () => {
  const schema = generateShelfFilterJsonSchema()

  return NextResponse.json(schema)
})
