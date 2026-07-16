import { type JobEvent } from "@/jobEvents"

type Listener = (event: JobEvent) => void

// a single shared EventSource for all job-event subscribers, mirroring
// bookEventsStream so we don't exhaust the browser's per-host connection budget.
let eventSource: EventSource | null = null
const listeners = new Set<Listener>()

function handleMessage(m: MessageEvent<string>) {
  const event = JSON.parse(m.data) as JobEvent
  for (const listener of [...listeners]) listener(event)
}

export function subscribeToJobEventStream(listener: Listener): () => void {
  if (typeof EventSource === "undefined") return () => {}

  listeners.add(listener)
  if (!eventSource) {
    eventSource = new EventSource("/api/v2/jobs/events")
    eventSource.addEventListener("message", handleMessage)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && eventSource) {
      eventSource.close()
      eventSource = null
    }
  }
}
