import assert from "node:assert"
import { describe, it } from "node:test"

import { isLocalOnlyUrl } from "@/deviceAuthorization"

void describe("isLocalOnlyUrl", () => {
  void it("treats wildcard bind addresses as local-only", () => {
    // The regression this exists for: a server listening on 0.0.0.0 reports
    // that as its own origin. Handing it to an e-reader configures the device
    // with a library it can never reach, and nothing fails loudly.
    assert.strictEqual(isLocalOnlyUrl("https://0.0.0.0:8001"), true)
    assert.strictEqual(isLocalOnlyUrl("http://[::]:8001"), true)
  })

  void it("treats loopback as local-only, bracketed IPv6 included", () => {
    assert.strictEqual(isLocalOnlyUrl("http://localhost:8001"), true)
    assert.strictEqual(isLocalOnlyUrl("http://127.0.0.1:8001"), true)
    // Anywhere in 127.0.0.0/8, not just .1.
    assert.strictEqual(isLocalOnlyUrl("http://127.1.2.3:8001"), true)
    // URL reports IPv6 hostnames bracketed, so a bare "::1" compare never fires.
    assert.strictEqual(isLocalOnlyUrl("http://[::1]:8001"), true)
  })

  void it("leaves addresses a device can actually reach alone", () => {
    assert.strictEqual(
      isLocalOnlyUrl("https://storyteller.h2innovations.ca"),
      false,
    )
    // A LAN address is reachable by a device on the same network.
    assert.strictEqual(isLocalOnlyUrl("http://192.168.100.14:8001"), false)
    // Not loopback despite the leading digits.
    assert.strictEqual(isLocalOnlyUrl("http://127.example.com"), false)
    assert.strictEqual(isLocalOnlyUrl("http://12.7.0.1:8001"), false)
  })

  void it("does not throw on input that is not a URL", () => {
    assert.strictEqual(isLocalOnlyUrl("not a url"), false)
    assert.strictEqual(isLocalOnlyUrl(""), false)
  })
})
