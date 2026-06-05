import { z } from "zod"

export const ViewKinds = ["grid", "list", "table"] as const
export type ViewKind = (typeof ViewKinds)[number]

export const UserPreferencesSchema = z.object({
  locale: z.string().nullable(),
  defaultReadingMode: z.enum(["readaloud", "audiobook", "epub"]).nullable(),
  defaultView: z.enum(ViewKinds).default("grid"),
  colorMode: z.enum(["colorful", "subdued"]).default("colorful"),
})

export type UserPreferences = z.infer<typeof UserPreferencesSchema>

export const defaultUserPreferences: UserPreferences = {
  locale: null,
  defaultReadingMode: null,
  defaultView: "grid",
  colorMode: "colorful",
}
