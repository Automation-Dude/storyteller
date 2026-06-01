import { type BookEvent } from "@/events"

type Listener = (event: BookEvent) => void

// a single shared EventSource for all book-event subscribers. opening one per
// rtk-query cache entry exhausts the browser's ~6 http/1.1 connections per host,
// which stalls every subsequent request once enough books have been opened.
let eventSource: EventSource | null = null
const listeners = new Set<Listener>()

function handleMessage(m: MessageEvent<string>) {
  const event = JSON.parse(m.data) as BookEvent
  // copy to tolerate unsubscribe during iteration
  for (const listener of [...listeners]) listener(event)
}

// returns an unsubscribe fn; opens the stream lazily, closes it when the last
// listener leaves. no-op on the server (no EventSource).
export function subscribeToBookEventStream(listener: Listener): () => void {
  if (typeof EventSource === "undefined") return () => {}

  listeners.add(listener)
  if (!eventSource) {
    eventSource = new EventSource("/api/v2/books/events")
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
