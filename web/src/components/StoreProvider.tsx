"use client"
import { useRef } from "react"
import { Provider } from "react-redux"

import { initializeAudioPlayerBridge } from "@/services/audioPlayerBridge"
import {
  loadGlobalPreferencesFromStorage,
  preferencesSlice,
} from "@/store/slices/preferencesSlice"
import {
  type UISettings,
  uiSettingsSlice,
} from "@/store/slices/uiSettingsSlice"
import { type AppStore, makeStore } from "@/store/store"

export default function StoreProvider({
  children,
  initialUISettings,
}: {
  children: React.ReactNode
  initialUISettings?: Partial<UISettings>
}) {
  const storeRef = useRef<AppStore>(undefined)
  if (!storeRef.current) {
    storeRef.current = makeStore()

    initializeAudioPlayerBridge(storeRef.current)

    const storedPreferences = loadGlobalPreferencesFromStorage() ?? {}
    storeRef.current.dispatch(
      preferencesSlice.actions.initGlobalPreferences({
        preferences: storedPreferences,
      }),
    )

    // hydrate ui settings synchronously so the very first render uses the
    // correct panel/sidebar widths (no flash from default -> stored values)
    if (initialUISettings) {
      storeRef.current.dispatch(
        uiSettingsSlice.actions.initUISettings(initialUISettings),
      )
    }
  }

  return <Provider store={storeRef.current}>{children}</Provider>
}
