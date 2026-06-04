import { type PayloadAction, createSlice } from "@reduxjs/toolkit"

export type UISettings = {
  detailPanelWidth: number
  librarySidebarWidth: number
}

const STORAGE_KEY = "ui-settings"

const defaults: UISettings = {
  detailPanelWidth: 420,
  librarySidebarWidth: 280,
}

export const loadUISettingsFromStorage = (): Partial<UISettings> | null => {
  if (typeof window === "undefined") return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as Partial<UISettings>
  } catch {
    return null
  }
}

const saveToStorage = (settings: UISettings): void => {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // silently fail
  }
}

export const uiSettingsSlice = createSlice({
  name: "uiSettings",
  initialState: defaults,

  reducers: {
    initUISettings: (state, action: PayloadAction<Partial<UISettings>>) => {
      return { ...defaults, ...state, ...action.payload }
    },

    setDetailPanelWidth: (state, action: PayloadAction<number>) => {
      state.detailPanelWidth = action.payload
      saveToStorage(state)
    },

    setLibrarySidebarWidth: (state, action: PayloadAction<number>) => {
      state.librarySidebarWidth = action.payload
      saveToStorage(state)
    },
  },
})

export const uiSettingsReducer = uiSettingsSlice.reducer

export const selectDetailPanelWidth = (state: { uiSettings: UISettings }) =>
  state.uiSettings.detailPanelWidth

export const selectLibrarySidebarWidth = (state: { uiSettings: UISettings }) =>
  state.uiSettings.librarySidebarWidth
