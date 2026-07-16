import assert from "node:assert"
import { describe, it } from "node:test"

import { type ReadiumLocator } from "@/database/positions"
import {
  koboProgressToLocator,
  koboReadingStateFromLocator,
} from "@/kobo/positions"

void describe("koboProgressToLocator", () => {
  void it("converts Kobo's percent to Readium's fraction", () => {
    // Kobo sends 0..100, Readium wants 0..1. Getting this wrong puts every
    // book at 100% the moment she opens it.
    const locator = koboProgressToLocator(42, "kobo.5.1")
    assert.strictEqual(locator.locations?.totalProgression, 0.42)
    // No optional chain: the assert above already proves locations is there.
    assert.strictEqual(locator.locations.progression, 0.42)
  })

  void it("keeps the device's own location, which we cannot interpret", () => {
    const locator = koboProgressToLocator(50, "kobo.12.3")
    assert.deepStrictEqual(locator.locations?.fragments, ["kobo.12.3"])
  })

  void it("omits fragments when the device sends no location", () => {
    const locator = koboProgressToLocator(50, null)
    assert.ok(!("fragments" in (locator.locations ?? {})))
  })

  void it("clamps nonsense rather than storing it", () => {
    // A bad value here propagates into the apps as a book that is -20% read.
    assert.strictEqual(
      koboProgressToLocator(-20, null).locations?.progression,
      0,
    )
    assert.strictEqual(
      koboProgressToLocator(180, null).locations?.progression,
      1,
    )
  })
})

void describe("koboReadingStateFromLocator", () => {
  const locatorAt = (totalProgression: number): ReadiumLocator => ({
    href: "",
    type: "application/xhtml+xml",
    locations: { totalProgression, progression: totalProgression },
  })

  void it("reports an unopened book as ready to read", () => {
    const state = koboReadingStateFromLocator("b", null, "t") as {
      StatusInfo: { Status: string }
      CurrentBookmark?: unknown
    }
    assert.strictEqual(state.StatusInfo.Status, "ReadyToRead")
    // No bookmark at all, rather than a bookmark at zero.
    assert.ok(!("CurrentBookmark" in state))
  })

  void it("reports a book in progress, so the device does not restart it", () => {
    const state = koboReadingStateFromLocator("b", locatorAt(0.42), "t") as {
      StatusInfo: { Status: string }
      CurrentBookmark: { ProgressPercent: number }
    }
    assert.strictEqual(state.StatusInfo.Status, "Reading")
    assert.strictEqual(state.CurrentBookmark.ProgressPercent, 42)
  })

  void it("reports a finished book as finished", () => {
    const state = koboReadingStateFromLocator("b", locatorAt(1), "t") as {
      StatusInfo: { Status: string }
    }
    assert.strictEqual(state.StatusInfo.Status, "Finished")
  })

  void it("round-trips a position through both directions unchanged", () => {
    // Kobo -> Storyteller -> Kobo. A unit mistake in either direction shows up
    // here as her place jumping.
    const fromDevice = koboProgressToLocator(37, "kobo.9.2")
    const backToDevice = koboReadingStateFromLocator("b", fromDevice, "t") as {
      CurrentBookmark: { ProgressPercent: number }
    }
    assert.strictEqual(backToDevice.CurrentBookmark.ProgressPercent, 37)
  })
})
