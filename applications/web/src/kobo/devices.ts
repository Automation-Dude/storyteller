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
    .select(["uuid", "userId", "label", "collectionUuid"])
    .where("tokenHash", "=", hashKoboToken(token))
    .where("revokedAt", "is", null)
    .executeTakeFirst()

  return device ?? null
}

/**
 * Register a device and return the token to put in its config. The token is
 * returned once, here, and only its digest is kept.
 */
export async function createKoboDevice(args: {
  userId: UUID
  label: string
  /** The shelf this device sees. Null means the whole library. */
  collectionUuid?: UUID | null
}): Promise<{ device: KoboDeviceRecord; token: string }> {
  const token = generateKoboToken()

  const device = await db
    .insertInto("koboDevice")
    .values({
      userId: args.userId,
      label: args.label,
      tokenHash: hashKoboToken(token),
      collectionUuid: args.collectionUuid ?? null,
    })
    .returning(["uuid", "userId", "label", "collectionUuid"])
    .executeTakeFirstOrThrow()

  return { device, token }
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
