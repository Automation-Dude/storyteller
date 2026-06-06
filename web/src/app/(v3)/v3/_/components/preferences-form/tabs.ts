// the searchable preference tabs (profile is separate and not searched)
export const preferenceTabs = ["general", "appearance", "books"] as const

export type PreferenceTab = (typeof preferenceTabs)[number]

// every tab the form can show, including profile
export type Tab = "profile" | PreferenceTab

// keywords per section, generated from the localized tab messages so search is
// localized (see generateSectionKeywords in the preferences page)
export type SectionKeywords = {
  [K in PreferenceTab]: {
    [section: string]: string[]
  }
}
