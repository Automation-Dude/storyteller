import { type Metadata } from "next"
import { redirect } from "next/navigation"
import { getMessages, getTranslations } from "next-intl/server"

import { PreferencesForm } from "@v3/_/components/preferences-form/preferences-form"
import {
  type SectionKeywords,
  preferenceTabs,
} from "@v3/_/components/preferences-form/tabs"

import { type User } from "@/apiModels"
import { fetchApiRoute } from "@/app/fetchApiRoute"
import { nextAuth } from "@/auth/auth"
import { getSettings } from "@/database/settings"
import { resolveUserPreferences } from "@/database/userPreferencesTypes"
import { getUserSettings } from "@/database/userSettings"
import { getAccounts } from "@/database/users"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PreferencesPage")
  return {
    title: t("title"),
  }
}

function extractKeywords(obj: Record<string, unknown>): string[] {
  const keywords: string[] = []
  for (const value of Object.values(obj)) {
    if (typeof value === "string") {
      keywords.push(value)
    } else if (typeof value === "object" && value !== null) {
      keywords.push(...extractKeywords(value as Record<string, unknown>))
    }
  }
  return keywords
}

// derive search keywords from the localized section messages so search works
// in whatever language the user is in (mirrors the settings page)
function generateSectionKeywords(
  tabsMessages: Record<string, { sections?: Record<string, unknown> }>,
): SectionKeywords {
  const result = {} as SectionKeywords

  for (const tab of preferenceTabs) {
    result[tab] = {}

    const sections = tabsMessages[tab]?.sections
    if (!sections) continue

    for (const [sectionKey, sectionData] of Object.entries(sections)) {
      result[tab][sectionKey] = extractKeywords(
        sectionData as Record<string, unknown>,
      )
    }
  }

  return result
}

export default async function PreferencesPage() {
  const auth = await nextAuth.auth()
  if (!auth) {
    redirect("/login")
  }

  const [settings, rawPreferences, linkedAccounts, messages] =
    await Promise.all([
      getSettings(),
      getUserSettings(auth.user.id),
      getAccounts(auth.user.id),
      getMessages(),
    ])

  const preferences = resolveUserPreferences(rawPreferences)

  const preferencesMessages = messages.PreferencesPage as {
    tabs: Record<string, { sections?: Record<string, unknown> }>
  }
  const sectionKeywords = generateSectionKeywords(preferencesMessages.tabs)

  const oauthProviders = settings.authProviders

  return (
    <PreferencesForm
      user={auth.user}
      preferences={preferences}
      sectionKeywords={sectionKeywords}
      linkedAccounts={linkedAccounts}
      providers={oauthProviders.map((provider) =>
        provider.kind === "built-in"
          ? { id: provider.id, name: provider.id }
          : { id: provider.name, name: provider.name },
      )}
      disablePasswordLogin={settings.disablePasswordLogin}
    />
  )
}
