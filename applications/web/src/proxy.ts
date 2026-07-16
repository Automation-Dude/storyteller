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
  "/formats",
  "/quality",
  "/not-found",
]

// routes that have no v3 page yet and must fall through to v2 even though they
// live under a v3-owned prefix like /books. the read route is not ported yet;
// let it resolve to the v2 page (full page load) instead of rewriting to a
// nonexistent /v3/books/[uuid]/read.
const V2_ONLY_PATTERNS = [/^\/books\/[^/]+\/read$/]

function hasV3Route(pathname: string): boolean {
  if (V2_ONLY_PATTERNS.some((pattern) => pattern.test(pathname))) return false

  if (V3_ROUTES.includes(pathname)) return true

  // match dynamic segments like /books/[uuid]
  return V3_ROUTES.some(
    (route) => route !== "/" && pathname.startsWith(route + "/"),
  )
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/v3")) return NextResponse.next()

  const versionCookie = request.cookies.get("frontend-version")?.value
  const wantsV2 = versionCookie === "v2"

  if (wantsV2 || !hasV3Route(pathname)) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = `/v3${pathname}`

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-v3-rewritten", "1")

  return NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: ["/((?!_next|api|fonts|.*\\..*).*)"],
}
