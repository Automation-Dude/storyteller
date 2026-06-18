import { open, readdir } from "node:fs/promises"

import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { LOG_DIR } from "@/directories"
import { getLogFilePath } from "@/logging"

export const dynamic = "force-dynamic"

const MAX_LINES = 5000
const DEFAULT_LINES = 500
const CHUNK_SIZE = 64 * 1024

const LEVEL_VALUES: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
}

// 0x0A is the newline byte; safe to split on even in multi-byte utf-8
// because 0x0A never appears as a continuation byte
function splitBufferOnNewlines(buf: Buffer): Buffer[] {
  const segments: Buffer[] = []
  let start = 0

  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0a) {
      segments.push(buf.subarray(start, i))
      start = i + 1
    }
  }

  if (start < buf.length) {
    segments.push(buf.subarray(start))
  }

  return segments
}

// reads a log file backwards in chunks, returning the last `lineCount`
// entries that pass the level and search filters. avoids loading the
// entire file into memory.
async function readLastMatchingLines(
  filePath: string,
  lineCount: number,
  minLevel: number,
  search: string,
): Promise<unknown[]> {
  let handle

  try {
    handle = await open(filePath, "r")
  } catch {
    return []
  }

  try {
    const { size: fileSize } = await handle.stat()

    if (fileSize === 0) {
      return []
    }

    let position = fileSize
    let carry: Buffer = Buffer.alloc(0)
    const matched: unknown[] = []

    while (position > 0 && matched.length < lineCount) {
      const readSize = Math.min(CHUNK_SIZE, position)
      position -= readSize

      const buf = Buffer.alloc(readSize)
      const { bytesRead } = await handle.read(buf, 0, readSize, position)
      const actualBuf = bytesRead < readSize ? buf.subarray(0, bytesRead) : buf

      const combined =
        carry.length > 0 ? Buffer.concat([actualBuf, carry]) : actualBuf

      const segments = splitBufferOnNewlines(combined)

      // when we haven't reached the start of the file, the first segment
      // may be a partial line cut by the chunk boundary
      carry =
        position > 0
          ? (segments.shift() ?? Buffer.alloc(0))
          : Buffer.alloc(0)

      // walk segments newest-first (end to start)
      for (let i = segments.length - 1; i >= 0; i--) {
        if (matched.length >= lineCount) break

        const lineStr = segments[i]!.toString("utf-8")
        if (!lineStr) continue

        // search against the raw json line directly instead of re-stringifying
        if (search && !lineStr.toLowerCase().includes(search)) continue

        try {
          const entry = JSON.parse(lineStr) as { level?: number }

          if (minLevel > 0 && (entry.level ?? 0) < minLevel) continue

          matched.push(entry)
        } catch {
          // skip malformed lines
        }
      }
    }

    // handle remaining carry (first line of the file)
    if (carry.length > 0 && matched.length < lineCount) {
      const lineStr = carry.toString("utf-8")

      if (lineStr) {
        const searchOk =
          !search || lineStr.toLowerCase().includes(search)

        if (searchOk) {
          try {
            const entry = JSON.parse(lineStr) as { level?: number }
            const levelOk =
              minLevel === 0 || (entry.level ?? 0) >= minLevel

            if (levelOk) {
              matched.push(entry)
            }
          } catch {
            // skip
          }
        }
      }
    }

    // collected newest-first, reverse to chronological order
    matched.reverse()
    return matched
  } finally {
    await handle.close()
  }
}

async function readAvailableDates(): Promise<string[]> {
  try {
    const files = await readdir(LOG_DIR)

    return files
      .map((f) => f.match(/^storyteller-(\d{4}-\d{2}-\d{2})\.log$/)?.[1])
      .filter((d): d is string => !!d)
      .sort()
      .reverse()
  } catch {
    return []
  }
}

export const GET = withHasPermission("settingsUpdate")(async (request) => {
  const url = new URL(request.url)

  const linesParam = url.searchParams.get("lines")
  const lineCount = Math.min(
    Math.max(1, parseInt(linesParam ?? "", 10) || DEFAULT_LINES),
    MAX_LINES,
  )

  const search = (url.searchParams.get("search") ?? "").toLowerCase()
  const levelParam = url.searchParams.get("level") ?? ""
  const dateParam = url.searchParams.get("date") ?? undefined
  const minLevel = LEVEL_VALUES[levelParam] ?? 0
  const filePath = getLogFilePath(dateParam)

  const [lines, availableDates] = await Promise.all([
    readLastMatchingLines(filePath, lineCount, minLevel, search),
    readAvailableDates(),
  ])

  return NextResponse.json({ lines, availableDates })
})
