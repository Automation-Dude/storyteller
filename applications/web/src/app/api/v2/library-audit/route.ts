import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { getCachedAudit, scheduleAuditRecompute } from "@/database/auditLibrary"

// Serves the pre-computed audit, kept fresh by a background pass, so the page
// loads instantly instead of scanning every cover on arrival.
export const dynamic = "force-dynamic"

/**
 * @summary Return the latest library audit
 * @desc Returns the cached audit (flagged books, per-issue counts, and when it
 *       was last computed). The first request ever starts the background pass.
 *       Admin only: it is a whole-library scan, not per-user data.
 */
export const GET = withHasPermission("settingsUpdate")(() => {
  const audit = getCachedAudit()
  if (audit.status === "never") scheduleAuditRecompute()
  return NextResponse.json(audit)
})

/**
 * @summary Rescan the library
 * @desc Starts a fresh background audit pass and returns the current cached
 *       result immediately. Poll GET to watch it refresh.
 */
export const POST = withHasPermission("settingsUpdate")(() => {
  scheduleAuditRecompute()
  return NextResponse.json(getCachedAudit())
})
