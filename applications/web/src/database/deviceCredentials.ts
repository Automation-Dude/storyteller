import { hash, verify } from "argon2"

import { db } from "@/database/connection"
import { type UUID } from "@/uuid"

export type DeviceCredential = {
  uuid: UUID
  userId: UUID
  label: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

/**
 * Create a per-device credential and return the one-time plaintext secret.
 * The secret is never stored; only its argon2 hash is kept, so it can be
 * shown to the caller once and then only ever verified.
 */
export async function createDeviceCredential(
  userId: UUID,
  label: string,
  secret: string,
): Promise<UUID> {
  const secretHash = await hash(secret)

  const row = await db
    .insertInto("deviceCredential")
    .values({ userId, label, secretHash })
    .returning("uuid")
    .executeTakeFirstOrThrow()

  return row.uuid as UUID
}

/**
 * Verify a supplied secret against a user's non-revoked device credentials.
 * Returns true on the first match, and records that the credential was used.
 *
 * A user can have several devices, so every active credential is checked. The
 * count is tiny (one per device), so this stays cheap.
 */
export async function verifyDeviceCredential(
  userId: UUID,
  secret: string,
): Promise<boolean> {
  const credentials = await db
    .selectFrom("deviceCredential")
    .select(["uuid", "secretHash"])
    .where("userId", "=", userId)
    .where("revokedAt", "is", null)
    .execute()

  for (const credential of credentials) {
    if (await verify(credential.secretHash, secret)) {
      await db
        .updateTable("deviceCredential")
        .set({ lastUsedAt: new Date().toISOString() })
        .where("uuid", "=", credential.uuid)
        .execute()
      return true
    }
  }

  return false
}

export async function listDeviceCredentials(
  userId: UUID,
): Promise<DeviceCredential[]> {
  const rows = await db
    .selectFrom("deviceCredential")
    .select([
      "uuid",
      "userId",
      "label",
      "createdAt",
      "lastUsedAt",
      "revokedAt",
    ])
    .where("userId", "=", userId)
    .orderBy("createdAt", "desc")
    .execute()

  return rows as DeviceCredential[]
}

export async function revokeDeviceCredential(
  userId: UUID,
  uuid: UUID,
): Promise<void> {
  await db
    .updateTable("deviceCredential")
    .set({ revokedAt: new Date().toISOString() })
    .where("uuid", "=", uuid)
    // Scope to the owner so one user cannot revoke another's device.
    .where("userId", "=", userId)
    .execute()
}
