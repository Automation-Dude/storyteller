// the desktop shell appends this token to the webview's user agent (see
// applications/desktop/src-tauri/src/main.rs); the browser info stays intact
// because the reader sniffs AppleWebKit
export const DESKTOP_UA_TOKEN = "StorytellerDesktop"

/** is this browsing context the desktop app's webview? (client-side) */
export function isDesktopApp(): boolean {
  if (typeof window === "undefined") return false
  return (
    navigator.userAgent.includes(DESKTOP_UA_TOKEN) ||
    "__TAURI__" in window ||
    "__TAURI_INTERNALS__" in window
  )
}

/** did this request come from the desktop app's webview? (server-side) */
export function isDesktopAppRequest(userAgent: string | null): boolean {
  return userAgent?.includes(DESKTOP_UA_TOKEN) ?? false
}
