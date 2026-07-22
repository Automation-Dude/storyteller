import assert from "node:assert"
import { describe, it } from "node:test"

import { isImprintName, parseSeriesString } from "@/metadata/openLibrary"

// Real strings from the production library's editions, verbatim: compound
// claims mangled series names into garbage rows, and publisher imprints
// ("Spectra") were written as series.
void describe("parseSeriesString", () => {
  void it("reads only the first claim of a compound series string", () => {
    assert.deepStrictEqual(
      parseSeriesString("The Riftwar Saga (#4); Riftwar Cycle (#3)"),
      { name: "The Riftwar Saga", position: 4 },
    )
    assert.deepStrictEqual(
      parseSeriesString("NUMA Files, 1; Dirk Pitt Adventures"),
      { name: "NUMA Files", position: 1 },
    )
    assert.deepStrictEqual(
      parseSeriesString("Xanth (3); The Magic of Xanth, Volulme 3"),
      { name: "Xanth", position: 3 },
    )
  })

  void it("keeps a semicolon that separates a name from its own number", () => {
    assert.deepStrictEqual(parseSeriesString("Cradle ; bk. 8"), {
      name: "Cradle",
      position: 8,
    })
  })

  void it("still reads the plain forms", () => {
    assert.deepStrictEqual(parseSeriesString("Wheel of Time (9)"), {
      name: "Wheel of Time",
      position: 9,
    })
    assert.deepStrictEqual(parseSeriesString("The Camel Club #3"), {
      name: "The Camel Club",
      position: 3,
    })
  })

  void it("refuses publisher imprints and collections as series", () => {
    assert.strictEqual(parseSeriesString("Spectra"), null)
    assert.strictEqual(parseSeriesString("Millennium SF Masterworks S"), null)
    assert.strictEqual(parseSeriesString("SF Masterworks (73)"), null)
  })
})

void describe("isImprintName", () => {
  void it("knows imprints from real series", () => {
    assert.ok(isImprintName("Spectra"))
    assert.ok(isImprintName("Millennium SF Masterworks S"))
    assert.ok(!isImprintName("Discworld"))
    assert.ok(!isImprintName("The Wheel of Time"))
  })
})
