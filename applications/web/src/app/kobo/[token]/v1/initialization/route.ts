import { NextResponse } from "next/server"

import { getDeviceVerificationBaseUrl } from "@/deviceAuthorization"
import { getKoboDeviceByToken } from "@/kobo/devices"
import { rewriteImageResources } from "@/kobo/initialization"
import { logger } from "@/logging"

export const dynamic = "force-dynamic"

type Params = Promise<{ token: string }>

const KOBO_STORE = "https://storeapi.kobo.com"

/**
 * @summary Tell a Kobo where things live
 * @desc Identical to the store's own answer, except that covers are fetched
 *       from us. Without this the device asks Kobo's CDN for a cover keyed by
 *       our book's uuid and shows a blank rectangle instead.
 */
export async function GET(request: Request, context: { params: Params }) {
  const { token } = await context.params

  const device = await getKoboDeviceByToken(token)
  if (!device)
    return NextResponse.json({ message: "Not found" }, { status: 404 })

  const url = new URL(request.url)
  // The request origin is the address we bind to, which is meaningless to a
  // device on the other side of the network.
  const base = (await getDeviceVerificationBaseUrl(url.origin)).replace(
    /\/+$/,
    "",
  )

  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete("host")

  try {
    const response = await fetch(
      `${KOBO_STORE}/v1/initialization${url.search}`,
      {
        method: "GET",
        headers: requestHeaders,
        redirect: "manual",
      },
    )

    if (!response.ok) {
      // Her device's own credentials, her device's own answer: pass the
      // store's refusal back rather than dress it up.
      const headers = new Headers(response.headers)
      headers.delete("content-encoding")
      headers.delete("content-length")
      headers.delete("transfer-encoding")
      return new NextResponse(response.body, {
        status: response.status,
        headers,
      })
    }

    const { rewritten, body } = rewriteImageResources(
      await response.json(),
      `${base}/kobo/${token}`,
    )
    if (!rewritten) {
      logger.warn(
        "Kobo initialization: unfamiliar response shape from the store; covers will come from Kobo and our books will have none",
      )
    }

    return NextResponse.json(body)
  } catch (e) {
    logger.warn({ msg: "Kobo initialization failed", err: e })
    return NextResponse.json({}, { status: 502 })
  }
}
