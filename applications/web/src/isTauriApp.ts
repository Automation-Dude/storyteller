// the tauri shell appends this token to the webview's user agent (see
// applications/tauri/src-tauri/src/main.rs); the browser info stays intact
// because the reader sniffs AppleWebKit
export const TAURI_UA_TOKEN = "StorytellerTauri"

/** is this browsing context the tauri app's webview? (client-side) */
export function isTauriApp(): boolean {
  if (typeof window === "undefined") return false

  return (
    navigator.userAgent.includes(TAURI_UA_TOKEN) ||
    "__TAURI__" in window ||
    "__TAURI_INTERNALS__" in window
  )
}

/** did this request come from the tauri app's webview? (server-side) */
export function isTauriAppRequest(userAgent: string | null): boolean {
  return userAgent?.includes(TAURI_UA_TOKEN) ?? false
}
