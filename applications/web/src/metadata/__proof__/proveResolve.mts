// Manual end-to-end proof (not a CI test): runs the REAL resolveBook against
// real flagged books pulled from the production DB, with only the file read
// stubbed to {} (the true state for these loose rips) and the Open Library
// calls live. Prints the actual resolution so the pipeline can be judged on
// real data. Run: npx tsx -C @storyteller-node src/metadata/__proof__/proveResolve.mts <need-desc.json>
import { readFileSync } from "node:fs"

import { type BookWithRelations } from "@/database/books"
import {
  fetchOpenLibraryDescription,
  searchOpenLibrary,
} from "@/metadata/openLibrary"
import { type ResolveDeps, resolveBook } from "@/metadata/resolve"
import { type UUID } from "@/uuid"

type Row = {
  uuid: string
  title: string
  author: string | null
  asset_dir: string | null
}

const path = process.argv[2]
if (!path) throw new Error("usage: proveResolve.mts <books.json>")
const rows = JSON.parse(readFileSync(path, "utf-8")) as Row[]
const sample = rows.slice(0, Number(process.argv[3] ?? 20))

let filledDesc = 0
let filledAuthor = 0
for (const r of sample) {
  const book = {
    uuid: r.uuid as UUID,
    title: r.title,
    authors: (r.author ? r.author.split("; ") : []).map((name) => ({ name })),
    language: null,
    description: null,
    assetDir: r.asset_dir,
  } as unknown as BookWithRelations

  const deps: ResolveDeps = {
    loadBook: async () => book,
    readLocal: async () => ({}), // loose rip: no embedded description (real case)
    search: searchOpenLibrary,
    fetchDescription: fetchOpenLibraryDescription,
    hasCover: async () => false,
  }

  const res = await resolveBook(book.uuid, undefined, deps)
  if (!res) continue
  const fields = Object.keys(res.choice)
  if (res.choice.description) filledDesc++
  if (res.choice.authors) filledAuthor++

  console.log(`\n[${r.title.slice(0, 52)}]  author=${r.author ?? "(none)"}`)
  console.log(
    `  match="${res.best?.title ?? "-"}" by ${res.best?.authors?.[0] ?? "-"} ` +
      `score=${res.best?.score?.toFixed(2) ?? "-"} confidence=${res.confidence}`,
  )
  if (!fields.length) {
    console.log("  -> nothing filled")
  } else {
    for (const f of fields) {
      const v = JSON.stringify((res.choice as Record<string, unknown>)[f])
      console.log(`  -> ${f} [${res.sources[f as keyof typeof res.sources]}]: ${v.slice(0, 90)}`)
    }
  }
  await new Promise((done) => setTimeout(done, 300))
}

console.log(
  `\n=== ${sample.length} books: ${filledDesc} got a description, ${filledAuthor} got an author ===`,
)
