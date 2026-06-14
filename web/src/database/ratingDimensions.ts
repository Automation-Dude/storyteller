// shared, db-free types + helpers for multidimensional ("JoJo") ratings.
// imported by both the server (userRatings) and the client (optimistic update +
// display), mirroring how userPreferencesTypes is shared.

// a single rating axis the user can customize in preferences. the id is stable
// (renaming the label keeps recorded scores), the label is what's displayed.
export type RatingDimension = { id: string; label: string }

// per-book scores keyed by dimension id. a missing key means that axis is
// deselected for this book and is excluded from the average.
export type RatingDimensionScores = Record<string, number>

export const RATING_DIMENSION_MIN = 0
export const RATING_DIMENSION_MAX = 5
export const RATING_DIMENSION_STEP = 0.5

// the default 5 P's (the user's text said "point", the reference uses Purpose)
export const DEFAULT_RATING_DIMENSIONS: RatingDimension[] = [
  { id: "plot", label: "Plot" },
  { id: "personal", label: "Personal" },
  { id: "pleasure", label: "Pleasure" },
  { id: "purpose", label: "Purpose" },
  { id: "prose", label: "Prose" },
]

export function isValidDimensionScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= RATING_DIMENSION_MIN &&
    value <= RATING_DIMENSION_MAX
  )
}

export function isValidDimensionScores(
  scores: unknown,
): scores is RatingDimensionScores {
  if (typeof scores !== "object" || scores === null || Array.isArray(scores)) {
    return false
  }
  return Object.values(scores as Record<string, unknown>).every(
    isValidDimensionScore,
  )
}

// mean of the selected (present) axes, rounded to 2 decimals. null when nothing
// is scored, so the caller can treat it as "no rating".
export function computeRatingAverage(
  scores: RatingDimensionScores | null | undefined,
): number | null {
  if (!scores) return null
  const values = Object.values(scores).filter(isValidDimensionScore)
  if (values.length === 0) return null
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  return Math.round(mean * 100) / 100
}

// strip trailing zeros for display: 5.00 -> "5", 4.80 -> "4.8", 4.83 -> "4.83"
export function formatRating(value: number): string {
  return parseFloat(value.toFixed(2)).toString()
}
