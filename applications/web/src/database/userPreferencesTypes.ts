import { z } from "zod"

import { DEFAULT_RATING_DIMENSIONS } from "./ratingDimensions"

export const ViewKinds = ["grid", "list", "table"] as const
export type ViewKind = (typeof ViewKinds)[number]

export const ColorModes = ["full", "medium", "minimal"] as const
export type ColorMode = (typeof ColorModes)[number]

export const GridCoverDisplays = ["auto", "ebook", "audiobook"] as const
export type GridCoverDisplay = (typeof GridCoverDisplays)[number]

export const GridCardSizes = [
  "smallest",
  "small",
  "medium",
  "large",
  "largest",
] as const
export type GridCardSize = (typeof GridCardSizes)[number]

export const BookDetailDisplays = ["3d", "cover"] as const
export type BookDetailDisplay = (typeof BookDetailDisplays)[number]

export const DoubleCoverAlignments = ["auto", "straight"] as const
export type DoubleCoverAlignment = (typeof DoubleCoverAlignments)[number]

export const RatingIcons = ["star", "heart"] as const
export type RatingIcon = (typeof RatingIcons)[number]

export const UserPreferencesSchema = z.object({
  locale: z.string().nullable(),
  defaultReadingMode: z.enum(["readaloud", "audiobook", "epub"]).nullable(),
  defaultView: z.enum(ViewKinds),
  colorMode: z.enum(ColorModes),
  colorIntensity: z.number().min(0).max(1),
  gridCoverDisplay: z.enum(GridCoverDisplays),
  gridCardSize: z.enum(GridCardSizes),
  doubleCoverAlignment: z.enum(DoubleCoverAlignments),
  bookDetailDisplay: z.enum(BookDetailDisplays),
  bookDetail3dView: z.number().int().min(0).nullable(),
  ratingIcon: z.enum(RatingIcons),
  accentColor: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .nullable(),
  ratingDimensions: z.array(
    z.object({ id: z.string().min(1), label: z.string() }),
  ),
  defaultStatusUuid: z.string().nullable(),
  layoutAnimations: z.boolean(),
  animatePanelOpen: z.boolean(),
})

export const NEUTRAL_COLOR_STRENGTH = 0.65

export type UserPreferences = z.infer<typeof UserPreferencesSchema>

export const defaultUserPreferences: UserPreferences = {
  locale: null,
  defaultReadingMode: null,
  defaultView: "grid",
  colorMode: "full",
  colorIntensity: NEUTRAL_COLOR_STRENGTH,
  gridCoverDisplay: "auto",
  gridCardSize: "medium",
  doubleCoverAlignment: "auto",
  bookDetailDisplay: "3d",
  bookDetail3dView: null,
  ratingIcon: "star",
  accentColor: null,
  ratingDimensions: DEFAULT_RATING_DIMENSIONS,
  defaultStatusUuid: null,
  layoutAnimations: true,
  animatePanelOpen: true,
}

const LEGACY_COLOR_MODES: Record<string, ColorMode> = {
  colorful: "full",
  subdued: "minimal",
}

export function resolveUserPreferences(
  raw: Record<string, unknown> | undefined | null,
): UserPreferences {
  const migrated: Record<string, unknown> = { ...(raw ?? {}) }

  if (typeof migrated["colorMode"] === "string") {
    migrated["colorMode"] =
      LEGACY_COLOR_MODES[migrated["colorMode"]] ?? migrated["colorMode"]
  }

  const resolved: UserPreferences = { ...defaultUserPreferences }
  for (const key of Object.keys(
    UserPreferencesSchema.shape,
  ) as (keyof UserPreferences)[]) {
    if (!(key in migrated)) continue
    const result = UserPreferencesSchema.shape[key].safeParse(migrated[key])
    if (result.success) {
      resolved[key] = result.data as never
    }
  }
  return resolved
}
