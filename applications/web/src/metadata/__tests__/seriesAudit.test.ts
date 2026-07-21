import assert from "node:assert"
import { describe, it } from "node:test"

import { type SeriesAuditBook, auditSeries } from "@/metadata/seriesAudit"
import { partsFromClaims, pickSeriesEntity } from "@/metadata/wikidata"
import { type UUID } from "@/uuid"

let nextUuid = 0
function book(over: {
  title: string
  authors?: string[]
  series?: { name: string; position: number | null }[]
}): SeriesAuditBook {
  nextUuid += 1
  return {
    uuid: `00000000-0000-0000-0000-${String(nextUuid).padStart(12, "0")}` as UUID,
    title: over.title,
    authors: (over.authors ?? []).map((name) => ({ name })),
    series: over.series ?? [],
  }
}

void describe("auditSeries", () => {
  void it("finds the hole in a numbered run", () => {
    const reports = auditSeries([
      book({
        title: "Pawn of Prophecy",
        authors: ["David Eddings"],
        series: [{ name: "The Belgariad", position: 1 }],
      }),
      book({
        title: "Queen of Sorcery",
        authors: ["David Eddings"],
        series: [{ name: "The Belgariad", position: 2 }],
      }),
      book({
        title: "Magician's Gambit",
        authors: ["David Eddings"],
        series: [{ name: "The Belgariad", position: 3 }],
      }),
      book({
        title: "Enchanters' End Game",
        authors: ["David Eddings"],
        series: [{ name: "The Belgariad", position: 5 }],
      }),
    ])
    assert.strictEqual(reports.length, 1)
    const belgariad = reports[0]
    assert.ok(belgariad)
    assert.deepStrictEqual(belgariad.missingPositions, [4])
    assert.deepStrictEqual(belgariad.havePositions, [1, 2, 3, 5])
    assert.strictEqual(belgariad.authorHint, "David Eddings")
  })

  void it("rescues a member's position from its own title", () => {
    const reports = auditSeries([
      book({
        title: "Unsouled (Cradle Book 1)",
        series: [{ name: "Cradle", position: 1 }],
      }),
      book({
        title: "Wintersteel (Cradle Book 8)",
        // Linked, but whoever linked it never set the position.
        series: [{ name: "Cradle", position: null }],
      }),
    ])
    const cradle = reports[0]
    assert.ok(cradle)
    assert.deepStrictEqual(cradle.havePositions, [1, 8])
    assert.deepStrictEqual(
      cradle.missingPositions,
      [2, 3, 4, 5, 6, 7],
      "the title-read position opens the run up to #8",
    )
  })

  void it("proposes linking a shelved book whose title names the series", () => {
    const reports = auditSeries([
      book({
        title: "Point of Impact",
        series: [{ name: "Bob Lee Swagger", position: 1 }],
      }),
      book({
        title: "Dead Zero - Bob Lee Swagger Series, Book 7",
        series: [],
      }),
    ])
    const swagger = reports[0]
    assert.ok(swagger)
    assert.strictEqual(swagger.unlinked.length, 1)
    const proposal = swagger.unlinked[0]
    assert.ok(proposal)
    assert.strictEqual(proposal.position, 7)
    assert.strictEqual(proposal.clueName, "Bob Lee Swagger")
  })

  void it("says nothing about gaps for a lone high-numbered volume", () => {
    const reports = auditSeries([
      book({
        title: "Raising Steam",
        series: [{ name: "Discworld", position: 40 }],
      }),
    ])
    const discworld = reports[0]
    assert.ok(discworld)
    assert.deepStrictEqual(discworld.missingPositions, [])
  })

  void it("groups the same series across casing differences", () => {
    const reports = auditSeries([
      book({
        title: "Book One",
        series: [{ name: "The Expanse", position: 1 }],
      }),
      book({
        title: "Book Two",
        series: [{ name: "the expanse", position: 2 }],
      }),
    ])
    assert.strictEqual(reports.length, 1)
    assert.strictEqual(reports[0]?.members.length, 2)
  })
})

void describe("wikidata parsing", () => {
  void it("picks the series entity, preferring the expected author", () => {
    const picked = pickSeriesEntity(
      [
        {
          id: "Q1",
          label: "New Spring",
          description: "novel by Robert Jordan",
        },
        {
          id: "Q2",
          label: "The Wheel of Time",
          description: "fantasy novel series by Robert Jordan",
        },
      ],
      "Robert Jordan",
    )
    assert.strictEqual(picked?.id, "Q2")
  })

  void it("returns null when nothing reads like a series", () => {
    const picked = pickSeriesEntity(
      [
        {
          id: "Q1",
          label: "New Spring",
          description: "novel by Robert Jordan",
        },
      ],
      null,
    )
    assert.strictEqual(picked, null)
  })

  void it("reads part ids and ordinals from a P527 claims payload", () => {
    const parts = partsFromClaims({
      claims: {
        P527: [
          {
            mainsnak: { datavalue: { value: { id: "Q100" } } },
            qualifiers: { P1545: [{ datavalue: { value: "4" } }] },
          },
          {
            mainsnak: { datavalue: { value: { id: "Q101" } } },
          },
        ],
      },
    })
    assert.deepStrictEqual(parts, [
      { id: "Q100", ordinal: 4 },
      { id: "Q101", ordinal: null },
    ])
  })
})
