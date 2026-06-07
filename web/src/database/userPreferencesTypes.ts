import { z } from "zod"

export const ViewKinds = ["grid", "list", "table"] as const
export type ViewKind = (typeof ViewKinds)[number]

// how much the extracted cover colors bleed into the surrounding ui.
// full: cover color everywhere (card bg, panel header, buttons, hover).
// medium: only the background behind a cover is tinted.
// minimal: no cover tinting, neutral theme.
export const ColorModes = ["full", "medium", "minimal"] as const
export type ColorMode = (typeof ColorModes)[number]

export const GridCoverDisplays = ["auto", "ebook", "audiobook"] as const
export type GridCoverDisplay = (typeof GridCoverDisplays)[number]

// preset card widths for the library grid. medium is the default. the pixel
// values live in the frontend (GRID_CARD_WIDTHS in BookGrid); this is the scale.
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

// fields are required (no zod defaults) so the form's input and output types
// match; missing/invalid stored values are filled in by resolveUserPreferences
export const UserPreferencesSchema = z.object({
  locale: z.string().nullable(),
  defaultReadingMode: z.enum(["readaloud", "audiobook", "epub"]).nullable(),
  defaultView: z.enum(ViewKinds),
  colorMode: z.enum(ColorModes),
  // multiplier on cover-tint opacity, 0 (faint) .. 1 (current)
  colorIntensity: z.number().min(0).max(1),
  gridCoverDisplay: z.enum(GridCoverDisplays),
  gridCardSize: z.enum(GridCardSizes),
  bookDetailDisplay: z.enum(BookDetailDisplays),
  // index into Book3D's VIEWS array, null = front cover
  bookDetail3dView: z.number().int().min(0).nullable(),
  // "#rgb" or "#rrggbb"; null means use the default accent color. stored with
  // the leading # so it can be dropped straight into a css color var
  accentColor: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .nullable(),
})

export type UserPreferences = z.infer<typeof UserPreferencesSchema>

export const defaultUserPreferences: UserPreferences = {
  locale: null,
  defaultReadingMode: null,
  defaultView: "grid",
  colorMode: "full",
  colorIntensity: 1,
  gridCoverDisplay: "auto",
  gridCardSize: "medium",
  bookDetailDisplay: "3d",
  bookDetail3dView: null,
  accentColor: null,
}

// the old colorMode values, mapped onto the new three-level scale
const LEGACY_COLOR_MODES: Record<string, ColorMode> = {
  colorful: "full",
  subdued: "minimal",
}

// merge stored settings over the defaults, tolerating missing/legacy/invalid
// values (a bad field is dropped rather than throwing). used everywhere
// preferences are resolved from the key-value store.
export function resolveUserPreferences(
  raw: Record<string, unknown> | undefined | null,
): UserPreferences {
  const migrated: Record<string, unknown> = { ...(raw ?? {}) }

  if (typeof migrated["colorMode"] === "string") {
    migrated["colorMode"] =
      LEGACY_COLOR_MODES[migrated["colorMode"]] ?? migrated["colorMode"]
  }

  // parse each known field independently so one bad value doesn't discard the
  // rest of the user's preferences
  const resolved: UserPreferences = { ...defaultUserPreferences }
  for (const key of Object.keys(
    UserPreferencesSchema.shape,
  ) as (keyof UserPreferences)[]) {
    if (!(key in migrated)) continue
    const result = UserPreferencesSchema.shape[key].safeParse(migrated[key])
    if (result.success) {
      // safe: the field schema matches the field's type
      resolved[key] = result.data as never
    }
  }
  return resolved
}
