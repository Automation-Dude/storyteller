import { searchOpenLibrary, fetchOpenLibraryEditionSeries, fetchOpenLibraryWorkSeries } from "@/metadata/openLibrary"
import { queryVariants, authorsMatch, titleSimilarity } from "@/metadata/titleCleaning"
const cases: [string, string][] = [
  ["Raising Steam: (Discworld novel 40) (Discworld series) (Discworld Novels)", "Terry Pratchett"],
  ["Discworld 12 - Witches Abroad", "Terry Pratchett"],
  ["The Diamond Throne", "David Eddings"],
  ["Yes Please", "Amy Poehler"],
  ["Flowers for Algernon", "Daniel Keyes"],
]
for (const [title, author] of cases) {
  let best = null as Awaited<ReturnType<typeof searchOpenLibrary>>[number] | null
  const rungs: string[] = []
  for (const q of queryVariants(title)) {
    rungs.push(q)
    const [c] = await searchOpenLibrary(q, author)
    if (c && (!best || c.score > best.score)) best = c
    if (best && best.score >= 0.85) break
  }
  const confirmed = best && best.score >= 0.3 &&
    best.authors.some((n) => authorsMatch(n, author)) &&
    titleSimilarity(best.title, title) >= 0.5
  const conf = best ? (best.score >= 0.85 || confirmed ? "high" : best.score >= 0.3 ? "low" : "none") : "none"
  let series = null
  if (best && conf === "high") {
    series = (best.editionKey ? await fetchOpenLibraryEditionSeries(best.editionKey) : null)
      ?? (await fetchOpenLibraryWorkSeries(best.workKey))
  }
  console.log(`${title.slice(0, 44)}: rungs=${rungs.length} best="${best?.title}" score=${best?.score.toFixed(2)} conf=${conf} series=${JSON.stringify(series)}`)
  await new Promise((d) => setTimeout(d, 400))
}
