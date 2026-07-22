import { useSyncExternalStore } from "react"

// history.length can't answer "can we go forward" and never shrinks, so we
// stamp our own index into every history entry: pushState/replaceState are
// patched (next's router calls straight through them), popstate reads the
// stamped index back. the furthest index survives reloads via sessionStorage
const IDX_KEY = "__navIdx"
const MAX_KEY = "storyteller-nav-max"

type NavState = { canGoBack: boolean; canGoForward: boolean }

const defaultState: NavState = { canGoBack: false, canGoForward: false }

let snapshot: NavState = defaultState
let idx = 0
let max = 0
let installed = false
const listeners = new Set<() => void>()

function update() {
  const canGoBack = idx > 0
  const canGoForward = idx < max
  if (
    canGoBack !== snapshot.canGoBack ||
    canGoForward !== snapshot.canGoForward
  ) {
    snapshot = { canGoBack, canGoForward }
    for (const listener of listeners) listener()
  }
}

function setMax(value: number) {
  max = value
  try {
    sessionStorage.setItem(MAX_KEY, String(value))
  } catch {
    // storage may be unavailable, forward detection just degrades
  }
}

function install() {
  if (installed) return
  installed = true

  const stamped = (window.history.state as Record<string, unknown> | null)?.[
    IDX_KEY
  ]
  if (typeof stamped === "number") {
    idx = stamped
    const storedMax = Number(sessionStorage.getItem(MAX_KEY))
    max = Number.isFinite(storedMax) ? Math.max(storedMax, idx) : idx
  } else {
    window.history.replaceState(
      { ...(window.history.state as object | null), [IDX_KEY]: 0 },
      "",
    )
  }

  const pushState = window.history.pushState.bind(window.history)
  window.history.pushState = (state, unused, url) => {
    idx += 1
    setMax(idx)
    pushState({ ...(state as object | null), [IDX_KEY]: idx }, unused, url)
    update()
  }
  const replaceState = window.history.replaceState.bind(window.history)
  window.history.replaceState = (state, unused, url) => {
    replaceState({ ...(state as object | null), [IDX_KEY]: idx }, unused, url)
  }
  window.addEventListener("popstate", (event) => {
    const landed = (event.state as Record<string, unknown> | null)?.[IDX_KEY]
    if (typeof landed === "number") {
      idx = landed
      if (idx > max) setMax(idx)
    }
    update()
  })
  update()
}

function subscribe(listener: () => void) {
  install()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useCanGoBack(): NavState {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => defaultState,
  )
}
