import { createHash, randomBytes } from "node:crypto"

import { db } from "@/database/connection"
import { type UUID } from "@/uuid"

/**
 * A Kobo is pointed at Storyteller by rewriting one line of its config:
 *
 *   api_endpoint=https://<server>/kobo/<token>
 *
 * so the token in that URL is the device's whole credential. It is stored as a
 * sha256 digest rather than an argon2 hash: every sync request carries it in
 * the path and has to be looked up directly, which a salted hash cannot do.
 * The token is 32 random bytes, server generated, so there is nothing to brute
 * force and no work factor to justify.
 */

export function generateKoboToken(): string {
  return randomBytes(32).toString("hex")
}

export function hashKoboToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export type KoboDeviceRecord = {
  uuid: string
  userId: string
  label: string
  collectionUuid: UUID | null
  /** True when the reader was given everything rather than a shelf. */
  wholeLibrary: boolean
}

/**
 * SQLite has no boolean, so the flag comes back as 0 or 1. Convert it here
 * rather than leave 0/1 to be truthiness-tested all over the sync.
 */
function toRecord(row: {
  uuid: string
  userId: string
  label: string
  collectionUuid: UUID | null
  wholeLibrary: number
}): KoboDeviceRecord {
  return { ...row, wholeLibrary: Boolean(row.wholeLibrary) }
}

/**
 * Resolve the token from a request path to its device.
 *
 * Returns null for an unknown or revoked token, so a revoked device stops
 * syncing the moment it is revoked rather than at some later expiry.
 */
export async function getKoboDeviceByToken(
  token: string,
): Promise<KoboDeviceRecord | null> {
  const device = await db
    .selectFrom("koboDevice")
    .select(["uuid", "userId", "label", "collectionUuid", "wholeLibrary"])
    .where("tokenHash", "=", hashKoboToken(token))
    .where("revokedAt", "is", null)
    .executeTakeFirst()

  return device ? toRecord(device) : null
}

/**
 * Register a device and return the token to put in its config. The token is
 * returned once, here, and only its digest is kept.
 *
 * Keyed by the device's serial, so setting the same e-reader up twice rotates
 * its token rather than leaving the first one behind. Without that, every
 * retry, and every failed config write, would strand a live key to someone's
 * library that nobody knows exists and nobody will revoke.
 *
 * A device with no serial (nothing reported it) always gets its own row: there
 * is nothing to recognise it by, and guessing would merge two real devices.
 */
export async function createKoboDevice(args: {
  userId: UUID
  label: string
  /** The device's own serial, from .kobo/version. */
  serial?: string | null
  /** The shelf this device sees. Null means everything. */
  collectionUuid?: UUID | null
}): Promise<{ device: KoboDeviceRecord; token: string }> {
  const token = generateKoboToken()
  const serial = args.serial?.trim() || null

  if (serial) {
    const existing = await db
      .selectFrom("koboDevice")
      .select("uuid")
      .where("userId", "=", args.userId)
      .where("serial", "=", serial)
      .executeTakeFirst()

    if (existing) {
      // Same device, set up again: rotate the token and take the new shelf.
      // The old token stops working, which is what re-running setup should
      // mean.
      const device = await db
        .updateTable("koboDevice")
        .set({
          label: args.label,
          tokenHash: hashKoboToken(token),
          collectionUuid: args.collectionUuid ?? null,
          wholeLibrary: args.collectionUuid ? 0 : 1,
          revokedAt: null,
        })
        .where("uuid", "=", existing.uuid)
        .returning([
          "uuid",
          "userId",
          "label",
          "collectionUuid",
          "wholeLibrary",
        ])
        .executeTakeFirstOrThrow()

      return { device: toRecord(device), token }
    }
  }

  const device = await db
    .insertInto("koboDevice")
    .values({
      userId: args.userId,
      label: args.label,
      serial,
      tokenHash: hashKoboToken(token),
      collectionUuid: args.collectionUuid ?? null,
      // Record what was chosen, so a shelf that later disappears does not read
      // as "give this reader everything".
      wholeLibrary: args.collectionUuid ? 0 : 1,
    })
    .returning(["uuid", "userId", "label", "collectionUuid", "wholeLibrary"])
    .executeTakeFirstOrThrow()

  return { device: toRecord(device), token }
}

export async function listKoboDevices(userId: UUID) {
  return db
    .selectFrom("koboDevice")
    .select([
      "uuid",
      "label",
      "collectionUuid",
      "createdAt",
      "lastSyncedAt",
      "revokedAt",
    ])
    .where("userId", "=", userId)
    .orderBy("createdAt", "desc")
    .execute()
}

export async function revokeKoboDevice(userId: UUID, deviceUuid: string) {
  await db
    .updateTable("koboDevice")
    .set({ revokedAt: new Date().toISOString() })
    .where("uuid", "=", deviceUuid)
    .where("userId", "=", userId)
    .execute()
}

export async function touchKoboDeviceSync(deviceUuid: string) {
  await db
    .updateTable("koboDevice")
    .set({ lastSyncedAt: new Date().toISOString() })
    .where("uuid", "=", deviceUuid)
    .execute()
}

/** Books this device has already been told about, so syncs stay incremental. */
export async function getSyncedBookUuids(
  deviceUuid: string,
): Promise<Set<string>> {
  const rows = await db
    .selectFrom("koboSyncedBook")
    .select("bookUuid")
    .where("koboDeviceUuid", "=", deviceUuid)
    .execute()
  return new Set(rows.map((row) => row.bookUuid))
}

/**
 * Forget that a device was sent these books.
 *
 * Used when a book leaves the device's shelf: the device is told to remove it,
 * and forgetting it here means putting the book back on the shelf later sends
 * it again rather than the device never hearing about it a second time.
 */
export async function forgetSyncedBooks(
  deviceUuid: string,
  bookUuids: string[],
): Promise<void> {
  if (!bookUuids.length) return
  await db
    .deleteFrom("koboSyncedBook")
    .where("koboDeviceUuid", "=", deviceUuid)
    .where("bookUuid", "in", bookUuids as UUID[])
    .execute()
}

export async function markBooksSynced(
  deviceUuid: string,
  bookUuids: UUID[],
): Promise<void> {
  if (!bookUuids.length) return
  await db
    .insertInto("koboSyncedBook")
    .values(
      bookUuids.map((bookUuid) => ({
        koboDeviceUuid: deviceUuid,
        bookUuid,
      })),
    )
    // A device can ask for the same book twice; that is not an error.
    .onConflict((oc) => oc.columns(["koboDeviceUuid", "bookUuid"]).doNothing())
    .execute()
}
