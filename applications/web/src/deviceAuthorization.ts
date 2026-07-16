import { networkInterfaces } from "node:os"

import { getSettings } from "@/database/settings"
import { env } from "@/env"

/**
 * True for addresses that only mean something on the machine serving the
 * request, so they must never be handed to a separate device.
 *
 * This covers the wildcard bind addresses as well as loopback. A server
 * listening on 0.0.0.0 reports that as its own origin, and 0.0.0.0 is "every
 * interface here", not somewhere an e-reader can connect to; handing it out
 * produced devices configured with an unreachable library.
 *
 * Exported for tests: getting this wrong is silent, and only shows up as a
 * device that cannot reach its library.
 */
export function isLocalOnlyUrl(candidate: string) {
  try {
    const { hostname } = new URL(candidate)
    // URL keeps IPv6 literals bracketed, e.g. "[::1]".
    const host = hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase()
    return (
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "::" ||
      host === "::1" ||
      // The whole 127.0.0.0/8 loopback range, not just 127.0.0.1. Anchored to
      // four octets so a real hostname like "127.example.com" is left alone.
      /^127(\.\d{1,3}){3}$/.test(host)
    )
  } catch {
    return false
  }
}

function getLanAddress() {
  const interfaces = networkInterfaces()

  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) {
        continue
      }

      if (
        address.address.startsWith("10.") ||
        address.address.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(address.address)
      ) {
        return address.address
      }
    }
  }

  return undefined
}

function normalizeDeviceBaseUrl(candidate: string) {
  const parsed = new URL(candidate)

  if (!isLocalOnlyUrl(parsed.toString())) {
    return parsed.toString()
  }

  const lanAddress = getLanAddress()
  if (!lanAddress) {
    return parsed.toString()
  }

  parsed.hostname = lanAddress
  return parsed.toString()
}

export function getDeviceVerificationPath(deviceCode: string) {
  return `/device?device_code=${encodeURIComponent(deviceCode)}`
}

export function getDeviceEntryPath() {
  return "/device"
}

export async function getDeviceVerificationUrl({
  deviceCode,
  fallbackOrigin,
}: {
  deviceCode: string
  fallbackOrigin?: string
}) {
  const baseUrl = await getDeviceVerificationBaseUrl(fallbackOrigin)
  return new URL(getDeviceVerificationPath(deviceCode), baseUrl).toString()
}

export async function getDeviceEntryUrl(fallbackOrigin?: string) {
  const baseUrl = await getDeviceVerificationBaseUrl(fallbackOrigin)
  return new URL(getDeviceEntryPath(), baseUrl).toString()
}

export async function getDeviceQrCodeUrl({
  deviceCode,
  fallbackOrigin,
}: {
  deviceCode: string
  fallbackOrigin?: string
}) {
  const baseUrl = await getDeviceVerificationBaseUrl(fallbackOrigin)
  return new URL(
    `/api/v2/device/qr/${encodeURIComponent(deviceCode)}`,
    baseUrl,
  ).toString()
}

export async function getDeviceVerificationBaseUrl(fallbackOrigin?: string) {
  const configuredWebUrl = (await getSettings()).webUrl

  const candidates =
    fallbackOrigin &&
    isLocalOnlyUrl(fallbackOrigin) &&
    configuredWebUrl &&
    !isLocalOnlyUrl(configuredWebUrl)
      ? [configuredWebUrl, fallbackOrigin, env.AUTH_URL]
      : [fallbackOrigin, configuredWebUrl, env.AUTH_URL]

  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }

    try {
      return normalizeDeviceBaseUrl(candidate)
    } catch {
      continue
    }
  }

  throw new Error("No valid base URL available for device authorization")
}
