"use client"

import { createContext, useContext, useMemo } from "react"

import {
  type UserPreferences,
  defaultUserPreferences,
  resolveUserPreferences,
} from "@/database/userPreferencesTypes"
import { useGetUserSettingsQuery } from "@/store/api"

const UserPreferencesContext = createContext<UserPreferences>(
  defaultUserPreferences,
)

// the live query takes over once it resolves; until then we render with the
// server-resolved values so there's no flash (see "server-resolve initial data")
export function UserPreferencesProvider({
  initialPreferences,
  children,
}: {
  initialPreferences: UserPreferences
  children: React.ReactNode
}) {
  const { data: rawSettings } = useGetUserSettingsQuery()

  const preferences = useMemo(() => {
    if (!rawSettings) return initialPreferences
    return resolveUserPreferences(rawSettings)
  }, [rawSettings, initialPreferences])

  return (
    <UserPreferencesContext.Provider value={preferences}>
      {children}
    </UserPreferencesContext.Provider>
  )
}

export function useUserPreferences(): UserPreferences {
  return useContext(UserPreferencesContext)
}
