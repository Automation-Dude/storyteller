import assert from "node:assert"
import { describe, it } from "node:test"

import { koreaderProgressToLocator } from "@/koreader/positions"

void describe("bridging KOReader progress into a Readium locator", () => {
  void it("maps the percentage onto totalProgression", () => {
    // totalProgression is what drives Storyteller's Reading and Read status
    // transitions, so it has to carry the e-reader's percentage.
    const locator = koreaderProgressToLocator(
      0.3188,
      "/body/DocFragment[20]/body/p[22]/img.0",
    )

    assert.strictEqual(locator.locations?.totalProgression, 0.3188)
  })

  void it("preserves the KOReader position verbatim", () => {
    // The progress string is an engine specific XPointer (or a page number for
    // paged formats). It is not a Readium locator and must survive untouched.
    const xpointer = "/body/DocFragment[20]/body/p[22]/img.0"
    const locator = koreaderProgressToLocator(0.5, xpointer)

    assert.deepStrictEqual(locator.locations?.fragments, [xpointer])
  })

  void it("keeps a paged position as its original string", () => {
    const locator = koreaderProgressToLocator(0.5, "56")

    assert.deepStrictEqual(locator.locations?.fragments, ["56"])
  })

  void it("carries a finished book past the read threshold", () => {
    // Storyteller marks a book Read at totalProgression >= 0.98.
    const locator = koreaderProgressToLocator(0.99, "/body/DocFragment[30]")

    assert.ok((locator.locations?.totalProgression ?? 0) >= 0.98)
  })
})
