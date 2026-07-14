import { db } from "@/database/connection"
import { type UUID } from "@/uuid"

export type KoreaderProgress = {
  document: string
  progress: string
  percentage: number
  device: string | null
  deviceId: string | null
  timestamp: number
}

export async function getKoreaderUser(username: string) {
  return db
    .selectFrom("koreaderUser")
    .selectAll()
    .where("username", "=", username)
    .executeTakeFirst()
}

export async function createKoreaderUser(
  userId: UUID,
  username: string,
  authKey: string,
) {
  return db
    .insertInto("koreaderUser")
    .values({ userId, username, authKey })
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Ensure a kosync identity exists for this user with the given key, creating
 * it or rotating the key on an existing one. kosync is one identity per person
 * (all their devices converge on the same reading position), so setting up a
 * new device rotates the shared key and every device re-logs in on next sync.
 */
export async function upsertKoreaderUserKey(
  userId: UUID,
  username: string,
  authKey: string,
) {
  await db
    .insertInto("koreaderUser")
    .values({ userId, username, authKey })
    .onConflict((oc) => oc.column("username").doUpdateSet({ userId, authKey }))
    .execute()
}

export async function getKoreaderProgress(
  koreaderUserUuid: UUID,
  document: string,
) {
  return db
    .selectFrom("koreaderProgress")
    .selectAll()
    .where("koreaderUserUuid", "=", koreaderUserUuid)
    .where("document", "=", document)
    .executeTakeFirst()
}

export async function upsertKoreaderProgress(
  koreaderUserUuid: UUID,
  progress: KoreaderProgress,
  bookUuid: UUID | null,
) {
  const values = {
    koreaderUserUuid,
    document: progress.document,
    progress: progress.progress,
    percentage: progress.percentage,
    device: progress.device,
    deviceId: progress.deviceId,
    timestamp: progress.timestamp,
    bookUuid,
  }

  // kosync is last-write-wins by protocol; KOReader does its own newer/older
  // reconciliation client side, so the server must not second-guess it.
  await db
    .insertInto("koreaderProgress")
    .values(values)
    .onConflict((oc) =>
      oc.columns(["koreaderUserUuid", "document"]).doUpdateSet(values),
    )
    .execute()
}

/**
 * Resolve a KOReader document digest to a Storyteller book. The mapping is
 * populated when a device downloads a file (the download route hashes what it
 * actually served), which is the only way to be sure the bytes on the device
 * are the bytes we hashed.
 */
export async function getBookUuidForDocument(document: string) {
  const row = await db
    .selectFrom("koreaderDocument")
    .select(["bookUuid"])
    .where("document", "=", document)
    .executeTakeFirst()

  return row?.bookUuid ?? null
}

export async function upsertKoreaderDocument(
  document: string,
  bookUuid: UUID,
  ebookUuid: UUID | null,
  readaloudUuid: UUID | null,
) {
  await db
    .insertInto("koreaderDocument")
    .values({ document, bookUuid, ebookUuid, readaloudUuid })
    .onConflict((oc) =>
      oc.column("document").doUpdateSet({ bookUuid, ebookUuid, readaloudUuid }),
    )
    .execute()
}
