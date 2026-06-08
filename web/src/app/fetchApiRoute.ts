import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { logger } from "@/logging"

import { apiHost } from "./apiHost"

export async function fetchApiRoute<Result>(endpoint: string) {
  const cookieStore = await cookies()
  const authTokenCookie = cookieStore.get("st_token")

  const response = await fetch(new URL(`/api/v2${endpoint}`, apiHost), {
    ...(authTokenCookie && {
      headers: { Authorization: `Bearer ${authTokenCookie.value}` },
    }),
  })

  if (!response.ok) {
    if (response.status === 404) {
      notFound()
    }

    if (response.status === 401) {
      // instrumentation for the spurious-logout investigation: a 401 here forces
      // a redirect to /login. record whether we even sent an auth token.
      logger.warn(
        {
          ctx: "auth-debug",
          endpoint,
          hadToken: authTokenCookie != null,
        },
        "fetchApiRoute: 401 from api, redirecting to /login",
      )
      redirect("/login")
    }

    if (response.status === 403) {
      notFound()
    }

    throw new Error(`Server error — check logs for details`)
  }

  const result = (await response.json()) as Result
  return result
}
