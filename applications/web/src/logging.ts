import { mkdirSync, readdirSync, unlinkSync } from "node:fs"
import { join } from "node:path"

import pino from "pino"
import PinoPretty from "pino-pretty"

import { LOG_DIR } from "./directories"
import { env } from "./env"

const LOG_RETENTION_DAYS = 14

function todayDateString() {
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

export function getLogFilePath(date?: string) {
  return join(LOG_DIR, `storyteller-${date ?? todayDateString()}.log`)
}

function ensureLogDir() {
  try {
    mkdirSync(LOG_DIR, { recursive: true })
  } catch {
    // directory already exists or can't be created
  }
}

function pruneOldLogs() {
  try {
    const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
    const files = readdirSync(LOG_DIR)

    for (const file of files) {
      const match = file.match(/^storyteller-(\d{4}-\d{2}-\d{2})\.log$/)
      if (!match?.[1]) continue

      const fileDate = new Date(match[1]).getTime()
      if (fileDate < cutoff) {
        try {
          unlinkSync(join(LOG_DIR, file))
        } catch {
          // best effort
        }
      }
    }
  } catch {
    // log dir may not exist yet
  }
}

ensureLogDir()
pruneOldLogs()

// schedule daily pruning
setInterval(pruneOldLogs, 24 * 60 * 60 * 1000).unref()

const prettyStream = PinoPretty({
  ignore: "pid,hostname,ctx",
  messageFormat: "{if ctx}{ctx} {end}{msg}",
  translateTime: "SYS:standard",
})

let currentLogDate = todayDateString()

const fileStream = pino.destination({
  dest: getLogFilePath(currentLogDate),
  mkdir: true,
  sync: false,
})

// rotate to a new file at midnight
setInterval(() => {
  const today = todayDateString()

  if (today !== currentLogDate) {
    currentLogDate = today
    fileStream.reopen(getLogFilePath(today))
    pruneOldLogs()
  }
}, 60 * 1000).unref()

export const logger = pino(
  { level: env.STORYTELLER_LOG_LEVEL },
  pino.multistream([
    { stream: prettyStream, level: env.STORYTELLER_LOG_LEVEL },
    { stream: fileStream, level: env.STORYTELLER_LOG_LEVEL },
  ]),
)
