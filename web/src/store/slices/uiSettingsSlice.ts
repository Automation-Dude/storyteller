import { type PayloadAction, createSlice } from "@reduxjs/toolkit"

export type UISettings = {
  detailPanelWidth: number
  librarySidebarWidth: number
}

const COOKIE_NAME = "st-ui"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const defaults: UISettings = {
  detailPanelWidth: 420,
  librarySidebarWidth: 280,
}

export function parseCookie(cookieString: string): Partial<UISettings> | null {
  try {
    const match = cookieString
      .split("; ")
      .find((row) => row.startsWith(`${COOKIE_NAME}=`))

    if (!match) return null

    const value = decodeURIComponent(match.split("=")[1] ?? "")
    return JSON.parse(value) as Partial<UISettings>
  } catch {
    return null
  }
}

export const loadUISettingsFromCookie = (): Partial<UISettings> | null => {
  if (typeof document === "undefined") return null
  return parseCookie(document.cookie)
}

// kept for backwards compat during transition; reads from localStorage then migrates to cookie
export const loadUISettingsFromStorage = (): Partial<UISettings> | null => {
  if (typeof window === "undefined") return null

  const fromCookie = loadUISettingsFromCookie()
  if (fromCookie) return fromCookie

  try {
    const stored = localStorage.getItem("ui-settings")
    if (!stored) return null

    const parsed = JSON.parse(stored) as Partial<UISettings>

    // migrate to cookie and remove localStorage entry
    saveToCookie({ ...defaults, ...parsed })
    localStorage.removeItem("ui-settings")

    return parsed
  } catch {
    return null
  }
}

function saveToCookie(settings: UISettings): void {
  if (typeof document === "undefined") return

  try {
    const value = JSON.stringify(settings)
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  } catch {
    // silently fail
  }
}

export { COOKIE_NAME as UI_SETTINGS_COOKIE_NAME }

export const uiSettingsSlice = createSlice({
  name: "uiSettings",
  initialState: defaults,

  reducers: {
    initUISettings: (state, action: PayloadAction<Partial<UISettings>>) => {
      return { ...defaults, ...state, ...action.payload }
    },

    setDetailPanelWidth: (state, action: PayloadAction<number>) => {
      state.detailPanelWidth = action.payload
      saveToCookie(state)
    },

    setLibrarySidebarWidth: (state, action: PayloadAction<number>) => {
      state.librarySidebarWidth = action.payload
      saveToCookie(state)
    },
  },
})

export const uiSettingsReducer = uiSettingsSlice.reducer

export const selectDetailPanelWidth = (state: { uiSettings: UISettings }) =>
  state.uiSettings.detailPanelWidth

export const selectLibrarySidebarWidth = (state: { uiSettings: UISettings }) =>
  state.uiSettings.librarySidebarWidth
