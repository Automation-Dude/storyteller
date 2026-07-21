import { searchOpenLibrary, fetchOpenLibraryEditionSeries } from "@/metadata/openLibrary"
const cases: [string, string][] = [
  ["Winter's Heart", "Robert Jordan"],
  ["The Gathering Storm", "Robert Jordan"],
  ["Ghostwater", "Will Wight"],
]
for (const [title, author] of cases) {
  const [best] = await searchOpenLibrary(title, author)
  const series = best?.editionKey ? await fetchOpenLibraryEditionSeries(best.editionKey) : null
  console.log(`${title}: work=${best?.workKey} score=${best?.score.toFixed(2)} series=${JSON.stringify(series)}`)
  await new Promise((d) => setTimeout(d, 400))
}
