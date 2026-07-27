import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { logger } from "@/logging"
import {
  type RepairChoice,
  applyRepair,
  backupBeforeRepair,
} from "@/metadata/repair"
import { type UUID } from "@/uuid"

export const dynamic = "force-dynamic"

type RepairRequest = RepairChoice & { bookUuid: UUID }

/**
 * @summary Apply chosen repairs to books
 * @desc Writes the accepted metadata and covers. Takes a database snapshot
 *       first, so the whole change can be undone by restoring one file. Admin
 *       only. Reports per-book success so a partial failure is visible rather
 *       than silent.
 */
export const POST = withHasPermission("settingsUpdate")(async (request) => {
  const body = (await request.json()) as { repairs?: RepairRequest[] }
  const repairs = Array.isArray(body.repairs) ? body.repairs : []
  if (repairs.length === 0) {
    return NextResponse.json({ message: "No repairs given" }, { status: 400 })
  }

  let backupPath: string
  try {
    backupPath = await backupBeforeRepair()
    logger.info(`repair: database backed up to ${backupPath} before applying`)
  } catch (error) {
    // No backup, no write: refuse rather than change data we cannot roll back.
    logger.error(`repair: backup failed, refusing to write: ${String(error)}`)
    return NextResponse.json(
      { message: "Could not back up the database; nothing was changed" },
      { status: 500 },
    )
  }

  const userId = request.auth.user.id
  const results: { bookUuid: UUID; ok: boolean; message?: string }[] = []
  for (const { bookUuid, ...choice } of repairs) {
    const result = await applyRepair(bookUuid, choice, userId)
    results.push({ bookUuid, ...result })
  }

  return NextResponse.json({
    backupPath,
    applied: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  })
})
