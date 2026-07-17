"use client"

import { createContext, useContext, useMemo } from "react"

import {
  type PreferenceDefaults,
  type UserPreferences,
  defaultUserPreferences,
  resolveUserPreferences,
} from "@/database/userPreferencesTypes"
import { useGetUserSettingsQuery } from "@/store/api"

const UserPreferencesContext = createContext<UserPreferences>(
  defaultUserPreferences,
)

export function UserPreferencesProvider({
  initialPreferences,
  preferenceDefaults = {},
  children,
}: {
  initialPreferences: UserPreferences
  preferenceDefaults?: PreferenceDefaults
  children: React.ReactNode
}) {
  const { data: rawSettings } = useGetUserSettingsQuery()

  const preferences = useMemo(() => {
    if (!rawSettings) return initialPreferences
    return resolveUserPreferences(rawSettings, preferenceDefaults)
  }, [rawSettings, initialPreferences, preferenceDefaults])

  return (
    <UserPreferencesContext.Provider value={preferences}>
      {children}
    </UserPreferencesContext.Provider>
  )
}

export function useUserPreferences(): UserPreferences {
  return useContext(UserPreferencesContext)
}
