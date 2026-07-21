// Manual proof (not CI): run the REAL overhauled searchOpenLibrary +
// fetchOpenLibraryDescription against known-bad cases and a random sample of
// the library's flagged books. Shows what the audit page would now find:
// work, edition, rating, English cover, description found or not.
// Run: npx tsx -C @storyteller-node src/metadata/__proof__/proveSearch.mts <need-desc.json> [n] [seed]
import { readFileSync } from "node:fs"

import {
  fetchOpenLibraryDescription,
  searchOpenLibrary,
} from "@/metadata/openLibrary"

type Row = { title: string; author: string | null }

// The case Jordan reproduced by hand: must resolve to the popular work
// OL448924W with an English edition, not an orphaned double.
const KNOWN: Row[] = [
  { title: "Clear & Present Danger", author: "Tom Clancy" },
  { title: "04 Clear & Present Danger", author: "Tom Clancy" },
]

const path = process.argv[2]
const n = Number(process.argv[3] ?? 10)
const seed = Number(process.argv[4] ?? 42)
const rows = JSON.parse(readFileSync(path, "utf-8")) as Row[]

// Deterministic sample (seeded LCG) so runs are comparable.
let state = seed
const rand = () => (state = (state * 48271) % 2147483647) / 2147483647
const sample = [...rows].sort(() => rand() - 0.5).slice(0, n)

let described = 0
let englishCover = 0
for (const row of [...KNOWN, ...sample]) {
  const candidates = await searchOpenLibrary(row.title, row.author ?? undefined)
  const best = candidates[0]
  console.log(`\n[${row.title.slice(0, 48)}] by ${row.author ?? "?"}`)
  if (!best) {
    console.log("  -> no candidates")
    continue
  }
  const description = await fetchOpenLibraryDescription(
    best.workKey,
    best.editionKey,
  )
  if (description) described++
  if (best.editionKey) englishCover++
  console.log(
    `  ${best.workKey} "${best.title}" by ${best.authors[0] ?? "?"} ` +
      `score=${best.score.toFixed(2)}`,
  )
  console.log(
    `  year=${best.firstPublishYear} editions=${best.editionCount} ` +
      `rating=${best.ratingsAverage?.toFixed(1) ?? "-"} (${best.ratingsCount}) ` +
      `edition=${best.editionKey ?? "-"} cover=${best.coverId ?? "-"}`,
  )
  console.log(
    description
      ? `  desc[${description.length}]: ${description.slice(0, 90)}`
      : "  desc: NONE",
  )
  await new Promise((done) => setTimeout(done, 400))
}
console.log(
  `\n=== sample of ${n}: ${described}/${n + KNOWN.length} with description, ` +
    `${englishCover}/${n + KNOWN.length} with an English-boosted edition ===`,
)
