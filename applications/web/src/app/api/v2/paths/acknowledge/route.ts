import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { setDataDirAnchor } from "@/database/pathRewrite"
import { DATA_DIR } from "@/directories"

export const dynamic = "force-dynamic"

/** admin decided the stored paths are fine as-is — adopt the current data dir */
export const POST = withHasPermission("settingsUpdate")(async () => {
  await setDataDirAnchor(DATA_DIR)
  return NextResponse.json({ ok: true })
})
