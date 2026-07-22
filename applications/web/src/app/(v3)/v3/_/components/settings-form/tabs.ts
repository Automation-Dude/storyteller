export const settingsFormTabs = [
  "library",
  "processing",
  "auth",
  "upload",
  "email",
  "opds",
] as const

export type SettingsFormTab = (typeof settingsFormTabs)[number]

export const adminTabs = [
  "users",
  "changelog",
  "logs",
  "queue",
  "backups",
] as const
export type AdminTab = (typeof adminTabs)[number]

export const tabs = [...settingsFormTabs, ...adminTabs] as const

export type Tab = (typeof tabs)[number]

export type SectionKeywords = {
  [K in SettingsFormTab]: {
    [S: string]: string[]
  }
}
