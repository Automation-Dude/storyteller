import { z } from "zod"

export const ViewKinds = ["grid", "list", "table"] as const
export type ViewKind = (typeof ViewKinds)[number]

export const UserSettingsForm = z.object({
  defaultView: z.enum(ViewKinds).default("grid"),
})
