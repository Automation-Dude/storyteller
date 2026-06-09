import { type NextRequest } from "next/server"

import { nextAuth } from "@/auth/auth" // Referring to the auth.ts we just created
import { logger } from "@/logging"

// instrumentation for the spurious-logout investigation: the nextAuth handlers
// are the one auth surface the proxy/guard logging doesn't cover (proxy excludes
// /api, guards don't wrap these). log when they emit a st_token Set-Cookie so we
// can see if an /api/v2/auth/* call is what clears the session cookie. remove
// once the cause is found.
function logStToken(response: Response, request: NextRequest) {
  try {
    const stTokenCookies = response.headers
      .getSetCookie()
      .filter((c) => c.startsWith("st_token="))
    if (stTokenCookies.length === 0) return

    const clears = stTokenCookies.some((c) => {
      const value = c.slice("st_token=".length).split(";")[0]
      const lower = c.toLowerCase()
      return (
        value === "" ||
        /max-age=0\b/.test(lower) ||
        lower.includes("expires=thu, 01 jan 1970")
      )
    })

    logger.warn(
      {
        ctx: "auth-debug",
        site: "nextAuthHandler",
        path: request.nextUrl.pathname,
        method: request.method,
        status: response.status,
        clears,
        setCookie: stTokenCookies,
      },
      `[auth-debug] nextAuthHandler emitted st_token Set-Cookie (clears=${clears}) on ${request.method} ${request.nextUrl.pathname}`,
    )
  } catch {
    // never let instrumentation break a request
  }
}

export async function GET(request: NextRequest) {
  const response = await nextAuth.handlers.GET(request)
  logStToken(response, request)
  return response
}

export async function POST(request: NextRequest) {
  const response = await nextAuth.handlers.POST(request)
  logStToken(response, request)
  return response
}
