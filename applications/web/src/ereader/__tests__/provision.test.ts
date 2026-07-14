import assert from "node:assert"
import { after, before, describe, it } from "node:test"

import { setupTestDb } from "@/__tests__/harness/testDb"
import { verifyDeviceCredential } from "@/database/deviceCredentials"
import { provisionEreader } from "@/ereader/provision"
import { getKoreaderUser } from "@/koreader/database"
import { type UUID } from "@/uuid"

let ctx: ReturnType<typeof setupTestDb>
let userId: UUID

void describe("provisioning an e-reader", () => {
  before(() => {
    ctx = setupTestDb()
    const permission = ctx.sqlite
      .prepare("INSERT INTO user_permission DEFAULT VALUES RETURNING uuid")
      .get() as { uuid: UUID }
    userId = (
      ctx.sqlite
        .prepare(
          "INSERT INTO user (user_permission_uuid, username, email) VALUES (?, 'alice', 'alice@example.com') RETURNING id",
        )
        .get(permission.uuid) as { id: UUID }
    ).id
  })

  after(() => {
    ctx[Symbol.dispose]()
  })

  void it("issues an OPDS credential that actually authenticates", async () => {
    const result = await provisionEreader({
      userId,
      username: "alice",
      libraryName: "Alice's Library",
      deviceLabel: "Kobo Clara BW",
      baseUrl: "https://books.example.com/",
    })

    // Pull the device secret straight out of the config the device will use,
    // then confirm the server would accept it. This proves the two halves
    // (what we write to the device, what the server checks) agree.
    const opds = result.files["settings/opds.lua"]
    const password = /\["password"\] = "([^"]+)"/.exec(opds)?.[1]
    assert.ok(password, "opds.lua must carry a device password")

    assert.strictEqual(await verifyDeviceCredential(userId, password), true)
  })

  void it("issues a kosync key that matches the stored identity", async () => {
    const result = await provisionEreader({
      userId,
      username: "alice",
      libraryName: "Alice's Library",
      deviceLabel: "Kobo Clara BW",
      baseUrl: "https://books.example.com",
    })

    const kosync = result.files["settings/kosync.lua"]
    const userkey = /\["userkey"\] = "([^"]+)"/.exec(kosync)?.[1]
    assert.ok(userkey)

    // The device sends this userkey as x-auth-key; it must equal what the
    // server stored, or sync silently fails with 401.
    const stored = await getKoreaderUser("alice")
    assert.strictEqual(stored?.authKey, userkey)
  })

  void it("builds clean URLs regardless of a trailing slash on the base", () => {
    // Guard against the classic double-slash bug in the embedded URLs.
    return provisionEreader({
      userId,
      username: "alice",
      libraryName: "L",
      deviceLabel: "D",
      baseUrl: "https://books.example.com/",
    }).then((result) => {
      assert.strictEqual(result.summary.libraryUrl, "https://books.example.com/opds")
      assert.strictEqual(result.summary.syncUrl, "https://books.example.com/kosync")
    })
  })

  void it("rotates the shared kosync key on re-setup", async () => {
    const first = await provisionEreader({
      userId,
      username: "alice",
      libraryName: "L",
      deviceLabel: "First device",
      baseUrl: "https://books.example.com",
    })
    const firstKey = /\["userkey"\] = "([^"]+)"/.exec(
      first.files["settings/kosync.lua"],
    )?.[1]

    const second = await provisionEreader({
      userId,
      username: "alice",
      libraryName: "L",
      deviceLabel: "Second device",
      baseUrl: "https://books.example.com",
    })
    const secondKey = /\["userkey"\] = "([^"]+)"/.exec(
      second.files["settings/kosync.lua"],
    )?.[1]

    assert.notStrictEqual(firstKey, secondKey)
    // The stored identity tracks the latest key.
    const stored = await getKoreaderUser("alice")
    assert.strictEqual(stored?.authKey, secondKey)
  })
})
