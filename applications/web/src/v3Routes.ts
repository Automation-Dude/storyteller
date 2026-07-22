// single source of truth for which paths are served by the v3 app.
// consumed by next.config.ts to generate the actual rewrite rules and by
// src/proxy.ts to stamp x-v3-rewritten on requests those rules will match.
//
// the rewrites live in next.config.ts rather than the proxy because a
// middleware NextResponse.rewrite carries an absolute url whose origin the
// router compares against the server's own configured hostname. NextURL
// normalizes loopback ips to "localhost" while the comparison side keeps the
// hostname verbatim, so any server bound to 127.0.0.1 (the desktop app) turns
// every rewrite into an "external" self-proxy — which breaks outright behind a
// tls-terminating proxy like tailscale serve (x-forwarded-proto https makes it
// fetch https from its own plain-http port). config rewrites are plain path
// mappings with no origin comparison, so they work under any bind address and
// any proxy.

export const V3_ROOTS = [
  "books",
  "series",
  "authors",
  "narrators",
  "translators",
  "tags",
  "publication-years",
  "ratings",
  "statuses",
  "collections",
  "settings",
  "login",
  "init",
  "preferences",
  "shelves",
  "formats",
  "quality",
  "not-found",
]

// routes that have no v3 page yet and must fall through to v2 even though they
// live under a v3-owned prefix like /books. the read route is not ported yet;
// let it resolve to the v2 page (full page load) instead of rewriting to a
// nonexistent /v3/books/[uuid]/read.
export const V2_ONLY_PATTERNS = [/^\/books\/[^/]+\/read$/]

export function hasV3Route(pathname: string): boolean {
  if (V2_ONLY_PATTERNS.some((pattern) => pattern.test(pathname))) return false

  if (pathname === "/") return true

  return V3_ROOTS.some(
    (root) => pathname === `/${root}` || pathname.startsWith(`/${root}/`),
  )
}
