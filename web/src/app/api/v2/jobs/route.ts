import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import {
  ACTIVE_JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
  getDisplayJobs,
} from "@/database/jobs"
import type { UUID } from "@/uuid"
import { reorderJobs } from "@/work/distributor"

export const dynamic = "force-dynamic"

/**
 * @summary List processing jobs
 * @desc Active (queued/running/paused) jobs by default; pass `all=true` for history.
 *       Run config is summarized (no secrets) before returning.
 */
export const GET = withHasPermission("bookProcess")(async (request) => {
  const type = request.nextUrl.searchParams.get("type")
  const limit = request.nextUrl.searchParams.get("limit")
  const offset = request.nextUrl.searchParams.get("offset")
  const jobs = await getDisplayJobs({
    ...(type
      ? {
          statuses:
            type === "active"
              ? ACTIVE_JOB_STATUSES
              : type === "finished"
                ? TERMINAL_JOB_STATUSES
                : undefined,
        }
      : {}),
    ...(limit ? { limit: parseInt(limit) } : {}),
    ...(offset ? { offset: parseInt(offset) } : {}),
  })
  return NextResponse.json(jobs)
})

/**
 * @summary Reorder the queue
 * @desc Body `{ order: jobUuid[] }`. Only queued jobs move; a running job keeps its slot.
 */
export const PATCH = withHasPermission("bookProcess")(async (request) => {
  const body = (await request.json().catch(() => ({}))) as {
    order?: string[]
  }
  if (body.order) await reorderJobs(body.order as UUID[])
  return new Response(null, { status: 204 })
})
