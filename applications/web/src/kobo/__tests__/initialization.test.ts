import assert from "node:assert"
import { describe, it } from "node:test"

import { rewriteImageResources } from "@/kobo/initialization"

const BASE = "https://books.example.com/kobo/tok3n"

/** Roughly what the store answers, trimmed to what we care about. */
function storeReply() {
  return {
    Resources: {
      image_host: "https://cdn.kobo.com",
      image_url_template:
        "https://cdn.kobo.com/{ImageId}/{width}/{height}/false/image.jpg",
      image_url_quality_template:
        "https://cdn.kobo.com/{ImageId}/{width}/{height}/{Quality}/{isGreyscale}/image.jpg",
      account_page: "https://www.kobo.com/account",
      library_sync: "https://storeapi.kobo.com/v1/library/sync",
    },
    SomethingElse: { keep: true },
  }
}

void describe("rewriteImageResources", () => {
  void it("points covers at us, so her library is not a wall of blank rectangles", () => {
    const { rewritten, body } = rewriteImageResources(storeReply(), BASE)
    const resources = (body as { Resources: Record<string, string> }).Resources

    assert.strictEqual(rewritten, true)
    assert.strictEqual(resources["image_host"], BASE)
    for (const key of ["image_url_template", "image_url_quality_template"]) {
      assert.ok(
        resources[key]?.startsWith(BASE),
        `${key} must point at us, got ${resources[key]}`,
      )
      assert.ok(
        !resources[key]?.includes("kobo.com"),
        `${key} must not still point at Kobo`,
      )
    }
  })

  void it("keeps the placeholders the device fills in", () => {
    const { body } = rewriteImageResources(storeReply(), BASE)
    const resources = (body as { Resources: Record<string, string> }).Resources

    // Substituted by the device; a literal here means every cover is one book.
    assert.match(resources["image_url_template"]!, /\{ImageId\}/)
    assert.match(resources["image_url_template"]!, /\{width\}\/\{height\}/)
    assert.match(resources["image_url_quality_template"]!, /\{ImageId\}/)
    assert.match(resources["image_url_quality_template"]!, /\{Quality\}/)
    assert.match(resources["image_url_quality_template"]!, /\{isGreyscale\}/)
  })

  void it("builds urls our cover route actually serves", () => {
    // The route is /{token}/{bookId}/{width}/{height}/{quality}/{isGreyscale}/image.jpg,
    // so a filled-in template must land on exactly those segments.
    const { body } = rewriteImageResources(storeReply(), BASE)
    const resources = (body as { Resources: Record<string, string> }).Resources

    const filled = resources["image_url_quality_template"]!.replace(
      "{ImageId}",
      "book-uuid",
    )
      .replace("{width}", "300")
      .replace("{height}", "400")
      .replace("{Quality}", "85")
      .replace("{isGreyscale}", "false")
    assert.strictEqual(
      filled,
      `${BASE}/book-uuid/300/400/85/false/image.jpg`,
      "quality template must match the cover route's shape",
    )

    const plain = resources["image_url_template"]!.replace(
      "{ImageId}",
      "book-uuid",
    )
      .replace("{width}", "300")
      .replace("{height}", "400")
    assert.strictEqual(
      plain,
      `${BASE}/book-uuid/300/400/100/false/image.jpg`,
      "plain template must also match the cover route's shape",
    )
  })

  void it("changes nothing else in the store's reply", () => {
    // The rest of that reply is what keeps her Kobo account and store working.
    const { body } = rewriteImageResources(storeReply(), BASE)
    const resources = (body as { Resources: Record<string, string> }).Resources

    assert.strictEqual(
      resources["account_page"],
      "https://www.kobo.com/account",
    )
    assert.strictEqual(
      resources["library_sync"],
      "https://storeapi.kobo.com/v1/library/sync",
    )
    assert.deepStrictEqual((body as { SomethingElse: unknown }).SomethingElse, {
      keep: true,
    })
  })

  void it("does not mutate what it was handed", () => {
    const original = storeReply()
    rewriteImageResources(original, BASE)
    assert.strictEqual(original.Resources.image_host, "https://cdn.kobo.com")
  })

  void it("passes an unfamiliar reply through untouched", () => {
    // Better a Kobo cover than a resource list we made up.
    for (const odd of [null, undefined, "nope", {}, { Resources: null }]) {
      const { rewritten, body } = rewriteImageResources(odd, BASE)
      assert.strictEqual(rewritten, false)
      assert.strictEqual(body, odd)
    }
  })

  void it("does not double up slashes when the base has a trailing one", () => {
    const { body } = rewriteImageResources(storeReply(), `${BASE}/`)
    const resources = (body as { Resources: Record<string, string> }).Resources
    assert.strictEqual(resources["image_host"], BASE)
    assert.ok(!resources["image_url_template"]?.includes("//{ImageId}"))
  })
})
