import { open, stat } from "node:fs/promises"

import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { getLogFilePath } from "@/logging"

export const dynamic = "force-dynamic"

const POLL_INTERVAL = 500
const READ_CHUNK = 64 * 1024

export const GET = withHasPermission("settingsUpdate")((request) => {
  if (request.headers.get("Accept") !== "text/event-stream") {
    return new NextResponse(null, { status: 405 })
  }

  let cancelled = false

  const readable = new ReadableStream({
    async start(controller) {
      let currentPath = getLogFilePath()
      let offset = 0
      let carry = ""

      try {
        const fileStat = await stat(currentPath)
        offset = fileStat.size
      } catch {
        offset = 0
      }

      const poll = async () => {
        if (cancelled) return

        try {
          // handle daily file rotation
          const newPath = getLogFilePath()
          if (newPath !== currentPath) {
            currentPath = newPath
            offset = 0
            carry = ""
          }

          let currentSize: number
          try {
            const fileStat = await stat(currentPath)
            currentSize = fileStat.size
          } catch {
            setTimeout(() => void poll(), POLL_INTERVAL)
            return
          }

          // file was truncated or rotated
          if (currentSize < offset) {
            offset = 0
            carry = ""
          }

          if (currentSize > offset) {
            const handle = await open(currentPath, "r")

            try {
              // read new content in bounded chunks so a burst
              // of logs doesn't allocate one huge buffer
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              while (offset < currentSize && !cancelled) {
                const readSize = Math.min(READ_CHUNK, currentSize - offset)
                const buf = Buffer.alloc(readSize)
                const { bytesRead } = await handle.read(
                  buf,
                  0,
                  readSize,
                  offset,
                )
                offset += bytesRead

                const text =
                  carry + buf.subarray(0, bytesRead).toString("utf-8")
                const parts = text.split("\n")

                // last element may be a partial line still being written
                carry = parts.pop() ?? ""

                for (const line of parts) {
                  if (!line) continue

                  try {
                    JSON.parse(line)
                    controller.enqueue(`data: ${line}\n\n`)
                  } catch {
                    // skip malformed
                  }
                }
              }
            } finally {
              await handle.close()
            }
          }
        } catch {
          // file read error, keep polling
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!cancelled) {
          setTimeout(() => void poll(), POLL_INTERVAL)
        }
      }

      void poll()
    },

    cancel() {
      cancelled = true
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
