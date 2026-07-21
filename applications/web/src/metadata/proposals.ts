import { type RepairChoice } from "./repair"
import { type RepairProposal } from "./resolve"

/**
 * The part of a repair proposal that is safe to apply without a person
 * looking at it.
 *
 * A fill that came out of the book's own files needs no catalogue confidence;
 * it IS the book's data. A fill that came from the catalogue is only safe in
 * bulk when the match scored as confident. Gating the whole proposal on
 * catalogue confidence threw away every file-sourced repair on books the
 * catalogue was unsure about, which collapsed auto-repair coverage.
 *
 * Kept free of server imports so the browser dialogs can share it.
 */
export function applicableChoice(proposal: RepairProposal): RepairChoice {
  const out: RepairChoice = {}
  const confident = proposal.confidence === "high"
  const usable = (field: keyof RepairChoice) =>
    proposal.sources[field] === "file" ||
    proposal.sources[field] === "derived" ||
    confident
  if (proposal.choice.title && usable("title"))
    out.title = proposal.choice.title
  if (proposal.choice.authors && usable("authors"))
    out.authors = proposal.choice.authors
  if (proposal.choice.language && usable("language"))
    out.language = proposal.choice.language
  if (proposal.choice.description && usable("description"))
    out.description = proposal.choice.description
  if (proposal.choice.coverUrl && usable("coverUrl"))
    out.coverUrl = proposal.choice.coverUrl
  if (proposal.choice.series && usable("series"))
    out.series = proposal.choice.series
  return out
}
