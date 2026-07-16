import { NextResponse } from "next/server"

import { getKoboDeviceByToken } from "@/kobo/devices"
import { logger } from "@/logging"

export const dynamic = "force-dynamic"

type Params = Promise<{ token: string; path: string[] }>

const KOBO_STORE = "https://storeapi.kobo.com"

/**
 * Everything a Kobo asks its store that is not part of serving her library.
 *
 * Pointing a device's api_endpoint here means we receive *all* of its store
 * traffic: analytics, its user profile, wishlists, firmware checks. We only
 * want to answer for the library, so the rest is handed to the real Kobo store
 * unchanged. Without this the device gets a 404 for ordinary requests and
 * starts behaving as if it were offline, which is exactly the "something
 * strange" a setup like this must not cause.
 *
 * Her account with Kobo keeps working; we are a library, not a replacement.
 */
async function proxy(request: Request, context: { params: Params }) {
  const { token, path } = await context.params

  // Only proxy for a device we actually know: this endpoint should not be an
  // open relay to Kobo for anyone who guesses the URL shape.
  const device = await getKoboDeviceByToken(token)
  if (!device)
    return NextResponse.json({ message: "Not found" }, { status: 404 })

  const url = new URL(request.url)
  const target = `${KOBO_STORE}/${path.join("/")}${url.search}`

  const requestHeaders = new Headers(request.headers)
  // Host must follow the request, not the one it arrived on.
  requestHeaders.delete("host")

  try {
    const response = await fetch(target, {
      method: request.method,
      headers: requestHeaders,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.arrayBuffer(),
      redirect: "manual",
    })

    // fetch has already decompressed the body, but the store's headers still
    // describe it as compressed and give its compressed length. Passing those
    // through hands the device a body that does not match what it was told to
    // expect, and it fails to parse a response that is actually fine.
    const responseHeaders = new Headers(response.headers)
    responseHeaders.delete("content-encoding")
    responseHeaders.delete("content-length")
    responseHeaders.delete("transfer-encoding")

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    })
  } catch (e) {
    // The store being unreachable must not look like a broken library.
    logger.warn({
      msg: "Kobo store proxy failed",
      path: path.join("/"),
      err: e,
    })
    return NextResponse.json({}, { status: 502 })
  }
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const DELETE = proxy
