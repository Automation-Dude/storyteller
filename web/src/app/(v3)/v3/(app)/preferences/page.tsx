import { type Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { PreferencesForm } from "@v3/_/components/preferences-form/preferences-form"

import { type User } from "@/apiModels"
import { fetchApiRoute } from "@/app/fetchApiRoute"
import { nextAuth } from "@/auth/auth"
import { getSettings } from "@/database/settings"
import {
  UserPreferencesSchema,
  defaultUserPreferences,
} from "@/database/userPreferencesTypes"
import { getUserSettings } from "@/database/userSettings"
import { getAccounts } from "@/database/users"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PreferencesPage")
  return {
    title: t("title"),
  }
}

export default async function PreferencesPage() {
  const auth = await nextAuth.auth()
  if (!auth) {
    redirect("/login")
  }

  const [currentUser, settings, rawPreferences, linkedAccounts, providers] =
    await Promise.all([
      fetchApiRoute<User>("/user"),
      getSettings(),
      getUserSettings(auth.user.id),
      getAccounts(auth.user.id),
      fetchApiRoute<Record<string, { id: string; name: string }>>(
        "/auth/providers",
      ),
    ])

  const preferences = {
    ...defaultUserPreferences,
    ...UserPreferencesSchema.partial().parse(rawPreferences),
  }

  const { credentials: _, ...oauthProviders } = providers

  return (
    <PreferencesForm
      user={currentUser}
      preferences={preferences}
      linkedAccounts={linkedAccounts}
      providers={Object.values(oauthProviders)}
      disablePasswordLogin={settings.disablePasswordLogin}
    />
  )
}
