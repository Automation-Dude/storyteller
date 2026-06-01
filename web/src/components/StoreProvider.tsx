"use client"
import { useEffect, useRef } from "react"
import { Provider } from "react-redux"

import { initializeAudioPlayerBridge } from "@/services/audioPlayerBridge"
import {
  loadGlobalPreferencesFromStorage,
  preferencesSlice,
} from "@/store/slices/preferencesSlice"
import {
  loadUISettingsFromStorage,
  uiSettingsSlice,
} from "@/store/slices/uiSettingsSlice"
import { type AppStore, makeStore } from "@/store/store"

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const storeRef = useRef<AppStore>(undefined)
  if (!storeRef.current) {
    // Create the store instance the first time this renders
    storeRef.current = makeStore()

    initializeAudioPlayerBridge(storeRef.current)

    const storedPreferences = loadGlobalPreferencesFromStorage() ?? {}
    storeRef.current.dispatch(
      preferencesSlice.actions.initGlobalPreferences({
        preferences: storedPreferences,
      }),
    )
  }

  // persist ui settings after mount
  // to avoid hydration mismatch
  useEffect(() => {
    const storedUISettings = loadUISettingsFromStorage() ?? {}
    storeRef.current?.dispatch(
      uiSettingsSlice.actions.initUISettings(storedUISettings),
    )
  }, [])

  return <Provider store={storeRef.current}>{children}</Provider>
}
