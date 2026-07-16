import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { subscribeToJobEvents } from "@/jobEvents"

export const dynamic = "force-dynamic"

/**
 * @summary Subscribe to job queue updates
 * @desc Server-sent events notifying subscribers of changes to processing jobs.
 */
export const GET = withHasPermission("bookProcess")((request) => {
  if (request.headers.get("Accept") !== "text/event-stream") {
    return new NextResponse(null, { status: 405 })
  }

  let unsubscribe: (() => void) | null = null
  const readable = new ReadableStream({
    start(controller) {
      unsubscribe = subscribeToJobEvents((event) => {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
      })
    },
    cancel() {
      unsubscribe?.()
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
      "Content-Encoding": "none",
    },
  })
})
