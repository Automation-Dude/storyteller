import { type NextRequest, NextResponse } from "next/server"

const V3_ROUTES = [
  "/",
  "/books",
  "/series",
  "/authors",
  "/narrators",
  "/translators",
  "/tags",
  "/publication-years",
  "/ratings",
  "/statuses",
  "/collections",
  "/settings",
  "/login",
  "/preferences",
  "/collections",
  "/shelves",
  "/not-found",
]

function hasV3Route(pathname: string): boolean {
  if (V3_ROUTES.includes(pathname)) return true

  // match dynamic segments like /books/[uuid]
  return V3_ROUTES.some(
    (route) => route !== "/" && pathname.startsWith(route + "/"),
  )
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isV3Enabled = process.env["ENABLE_V3_FRONTEND"] === "true"
  if (!isV3Enabled) return NextResponse.next()

  if (pathname.startsWith("/v3")) return NextResponse.next()

  const versionCookie = request.cookies.get("frontend-version")?.value
  const wantsV2 = versionCookie === "v2"

  if (wantsV2 || !hasV3Route(pathname)) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = `/v3${pathname}`

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-v3-rewritten", "1")

  // instrumentation for the spurious-logout investigation: log whether the auth
  // cookie is present on a rewritten request, so we can tell if the rewrite
  // coincides with the cookie going missing (runs in the edge runtime, so plain
  // console rather than the pino logger).
  // eslint-disable-next-line no-console
  console.info(
    `[auth-debug] proxy rewrite ${pathname} -> ${url.pathname} hasToken=${request.cookies.has(
      "st_token",
    )}`,
  )

  return NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: ["/((?!_next|api|fonts|.*\\..*).*)"],
}
