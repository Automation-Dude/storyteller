import { randomBytes } from "node:crypto"

import { createDeviceCredential } from "@/database/deviceCredentials"
import { upsertKoreaderUserKey } from "@/koreader/database"
import { type UUID } from "@/uuid"

import {
  type KosyncConfig,
  type OpdsCatalog,
  generateKosyncLua,
  generateOpdsLua,
} from "./config"

export type EreaderProvisionResult = {
  /** Contents keyed by their path under the KOReader settings directory. */
  files: {
    "settings/opds.lua": string
    "settings/kosync.lua": string
  }
  /** Human-readable summary for the setup UI; no secrets. */
  summary: {
    libraryUrl: string
    syncUrl: string
    username: string
    deviceLabel: string
  }
}

/** URL-safe high-entropy secret, distinct from any real password. */
function secret(bytes: number): string {
  return randomBytes(bytes).toString("hex")
}

/**
 * Provision everything a specific device needs to reach a user's library and
 * sync their position, and return the KOReader config files to write onto it.
 *
 * Nothing here is the user's real password:
 * - OPDS (library) gets a per-device credential, revocable on its own if the
 *   device is lost.
 * - kosync (position) uses the user's shared sync identity, its key rotated so
 *   the freshly set-up device and the others all agree.
 */
export async function provisionEreader(args: {
  userId: UUID
  username: string
  libraryName: string
  deviceLabel: string
  /** Public base URL of this Storyteller server, no trailing slash. */
  baseUrl: string
}): Promise<EreaderProvisionResult> {
  const base = args.baseUrl.replace(/\/+$/, "")

  // OPDS: a per-device secret the device sends as its basic-auth password.
  const deviceSecret = secret(32)
  await createDeviceCredential(args.userId, args.deviceLabel, deviceSecret)

  // kosync: rotate the user's shared sync key.
  const userkey = secret(16)
  await upsertKoreaderUserKey(args.userId, args.username, userkey)

  const opds: OpdsCatalog = {
    title: args.libraryName,
    url: `${base}/opds`,
    username: args.username,
    password: deviceSecret,
  }
  const kosync: KosyncConfig = {
    customServer: `${base}/kosync`,
    username: args.username,
    userkey,
  }

  return {
    files: {
      "settings/opds.lua": generateOpdsLua([opds]),
      "settings/kosync.lua": generateKosyncLua(kosync),
    },
    summary: {
      libraryUrl: opds.url,
      syncUrl: kosync.customServer,
      username: args.username,
      deviceLabel: args.deviceLabel,
    },
  }
}
