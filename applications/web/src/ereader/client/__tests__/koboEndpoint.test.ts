import assert from "node:assert"
import { describe, it } from "node:test"

import {
  patchKoboApiEndpoint,
  unpatchKoboApiEndpoint,
} from "@/ereader/client/plan"

const OURS = "https://storyteller.example/kobo/abc123"
const KOBO = "https://storeapi.kobo.com"

/** A Kobo eReader.conf, near enough: sections of key=value. */
const CONF = `[ApplicationPreferences]
AppFirstOpen=true

[OneStoreServices]
api_endpoint=${KOBO}
image_host=https://cdn.kobo.com

[FeatureSettings]
ExcludeSyncFolders=\\.(?:adds|kobo)
`

void describe("patchKoboApiEndpoint", () => {
  void it("redirects the store at us", () => {
    const out = patchKoboApiEndpoint(CONF, OURS)
    assert.match(
      out,
      new RegExp(`^api_endpoint=${OURS.replace(/\//g, "\\/")}$`, "m"),
    )
    // Exactly one endpoint line: two would make the device's behaviour a coin toss.
    assert.strictEqual(out.match(/^api_endpoint=/gm)?.length, 1)
  })

  void it("keeps the rest of her config untouched", () => {
    const out = patchKoboApiEndpoint(CONF, OURS)
    assert.match(out, /^AppFirstOpen=true$/m)
    assert.match(out, /^image_host=https:\/\/cdn\.kobo\.com$/m)
    assert.match(out, /^\[FeatureSettings\]$/m)
  })

  void it("preserves the original Kobo store so the device can be put back", () => {
    const out = patchKoboApiEndpoint(CONF, OURS)
    assert.match(
      out,
      new RegExp(
        `storyteller-previous-api_endpoint=${KOBO.replace(/\//g, "\\/")}`,
      ),
    )
  })

  void it("does not bury the original when setup is run twice", () => {
    // The bug this guards: re-running would otherwise record OUR endpoint as
    // the "previous" one, and the real Kobo store would be lost for good.
    const once = patchKoboApiEndpoint(CONF, OURS)
    const twice = patchKoboApiEndpoint(
      once,
      "https://storyteller.example/kobo/NEW",
    )

    assert.strictEqual(
      twice.match(/storyteller-previous-api_endpoint=/g)?.length,
      1,
    )
    assert.match(
      twice,
      new RegExp(
        `storyteller-previous-api_endpoint=${KOBO.replace(/\//g, "\\/")}`,
      ),
    )
    assert.match(
      twice,
      /^api_endpoint=https:\/\/storyteller\.example\/kobo\/NEW$/m,
    )
  })

  void it("is a no-op when it is already pointed at us", () => {
    const once = patchKoboApiEndpoint(CONF, OURS)
    assert.strictEqual(patchKoboApiEndpoint(once, OURS), once)
  })

  void it("adds the section when the conf has none", () => {
    const out = patchKoboApiEndpoint("[ApplicationPreferences]\nx=1\n", OURS)
    assert.match(out, /^\[OneStoreServices\]$/m)
    assert.match(out, /^api_endpoint=/m)
    assert.match(out, /^x=1$/m)
  })

  void it("handles an empty or missing conf", () => {
    assert.match(patchKoboApiEndpoint(null, OURS), /^api_endpoint=/m)
    assert.match(patchKoboApiEndpoint("", OURS), /^\[OneStoreServices\]$/m)
  })
})

void describe("unpatchKoboApiEndpoint", () => {
  void it("puts the device back on the real Kobo store", () => {
    const patched = patchKoboApiEndpoint(CONF, OURS)
    const restored = unpatchKoboApiEndpoint(patched)

    assert.match(
      restored,
      new RegExp(`^api_endpoint=${KOBO.replace(/\//g, "\\/")}$`, "m"),
    )
    // Our marker must not linger once it has been used.
    assert.ok(!/storyteller-previous/.test(restored))
    assert.strictEqual(restored.match(/^api_endpoint=/gm)?.length, 1)
  })

  void it("round-trips back to the original config", () => {
    const restored = unpatchKoboApiEndpoint(patchKoboApiEndpoint(CONF, OURS))
    assert.strictEqual(restored.trim(), CONF.trim())
  })

  void it("leaves a conf it never touched alone", () => {
    assert.strictEqual(unpatchKoboApiEndpoint(CONF), CONF)
  })
})
