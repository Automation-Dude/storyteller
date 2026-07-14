import assert from "node:assert"
import { after, before, describe, it } from "node:test"

import { setupTestDb } from "@/__tests__/harness/testDb"
import {
  createDeviceCredential,
  listDeviceCredentials,
  revokeDeviceCredential,
  verifyDeviceCredential,
} from "@/database/deviceCredentials"
import { type UUID } from "@/uuid"

let ctx: ReturnType<typeof setupTestDb>
let userId: UUID
let otherUserId: UUID

void describe("device credentials", () => {
  const insertUser = (username: string): UUID => {
    const permission = ctx.sqlite
      .prepare("INSERT INTO user_permission DEFAULT VALUES RETURNING uuid")
      .get() as { uuid: UUID }
    return (
      ctx.sqlite
        .prepare(
          "INSERT INTO user (user_permission_uuid, username, email) VALUES (?, ?, ?) RETURNING id",
        )
        .get(permission.uuid, username, `${username}@example.com`) as {
        id: UUID
      }
    ).id
  }

  before(() => {
    ctx = setupTestDb()
    userId = insertUser("alice")
    otherUserId = insertUser("bob")
  })

  after(() => {
    ctx[Symbol.dispose]()
  })

  void it("verifies the exact secret it was created with", async () => {
    await createDeviceCredential(userId, "Kobo Clara BW", "correct-horse")

    assert.strictEqual(
      await verifyDeviceCredential(userId, "correct-horse"),
      true,
    )
    assert.strictEqual(
      await verifyDeviceCredential(userId, "wrong-secret"),
      false,
    )
  })

  void it("does not accept one user's device secret for another user", async () => {
    await createDeviceCredential(userId, "Alice Kobo", "alice-device-secret")

    // Bob presenting Alice's secret must fail: credentials are scoped to the
    // owner, so a leaked secret cannot be used against a different account.
    assert.strictEqual(
      await verifyDeviceCredential(otherUserId, "alice-device-secret"),
      false,
    )
  })

  void it("stops accepting a secret once its credential is revoked", async () => {
    await createDeviceCredential(userId, "Old Kindle", "lost-device-secret")
    assert.strictEqual(
      await verifyDeviceCredential(userId, "lost-device-secret"),
      true,
    )

    const creds = await listDeviceCredentials(userId)
    const lost = creds.find((c) => c.label === "Old Kindle")
    assert.ok(lost)
    await revokeDeviceCredential(userId, lost.uuid)

    // A revoked device cannot pull the library, which is the whole point of
    // per-device credentials: losing the device does not expose the account.
    assert.strictEqual(
      await verifyDeviceCredential(userId, "lost-device-secret"),
      false,
    )
  })

  void it("keeps other devices working after one is revoked", async () => {
    await createDeviceCredential(userId, "Phone", "phone-secret")
    await createDeviceCredential(userId, "Tablet", "tablet-secret")

    const creds = await listDeviceCredentials(userId)
    const phone = creds.find((c) => c.label === "Phone")
    assert.ok(phone)
    await revokeDeviceCredential(userId, phone.uuid)

    assert.strictEqual(await verifyDeviceCredential(userId, "phone-secret"), false)
    assert.strictEqual(
      await verifyDeviceCredential(userId, "tablet-secret"),
      true,
    )
  })

  void it("cannot be revoked by a different user", async () => {
    await createDeviceCredential(userId, "Alice Sole Device", "alice-only")
    const creds = await listDeviceCredentials(userId)
    const target = creds.find((c) => c.label === "Alice Sole Device")
    assert.ok(target)

    // Bob tries to revoke Alice's credential; the owner scope must protect it.
    await revokeDeviceCredential(otherUserId, target.uuid)

    assert.strictEqual(await verifyDeviceCredential(userId, "alice-only"), true)
  })
})
