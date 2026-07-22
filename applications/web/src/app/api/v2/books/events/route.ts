import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { subscribeToBookEvents } from "@/events"

export const dynamic = "force-dynamic"

// idle SSE connections can be silently dropped (os sleep, timeouts, proxies);
// without traffic the EventSource never notices and just receives nothing
// forever. a periodic comment keeps the connection verifiably alive.
const HEARTBEAT_INTERVAL_MS = 15_000

/**
 * @summary Subscribe to updates to the book list
 * @desc Uses server-sent events to notify subscribers of updates
 *       to the set of books.
 */
export const GET = withHasPermission("bookList")((request) => {
  if (request.headers.get("Accept") !== "text/event-stream") {
    return new NextResponse(null, { status: 405 })
  }

  let unsubscribe: (() => void) | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null
  const readable = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(chunk)
        } catch {
          // client went away without cancel() firing yet
          if (heartbeat) clearInterval(heartbeat)
          unsubscribe?.()
        }
      }
      // flush headers and a first byte right away so the client sees a live
      // stream immediately
      send(`: connected\n\n`)
      heartbeat = setInterval(() => {
        send(`: ping\n\n`)
      }, HEARTBEAT_INTERVAL_MS)
      unsubscribe = subscribeToBookEvents((event) => {
        send(`data: ${JSON.stringify(event)}\n\n`)
      })
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat)
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
