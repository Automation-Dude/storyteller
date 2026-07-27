import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { auditLibrary } from "@/database/auditLibrary"

// The audit reads every book's cover off disk, so it must not be cached.
export const dynamic = "force-dynamic"

/**
 * @summary Audit the library for books an e-reader shelf shows badly
 * @desc Returns every book with a missing, blank or tiny cover, a missing
 *       author/language/description, or a filename-like title. Admin only:
 *       it is a whole-library scan, not per-user data.
 */
export const GET = withHasPermission("settingsUpdate")(async () => {
  const audit = await auditLibrary()
  return NextResponse.json(audit)
})
