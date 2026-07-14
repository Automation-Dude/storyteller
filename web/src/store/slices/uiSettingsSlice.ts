import { type PayloadAction, createSlice } from "@reduxjs/toolkit"

import { type DisplayField } from "@/sort"

export type BookView = "grid" | "list"

export type LogDisplayPrefs = {
  wrapLines: boolean
  highlighting: boolean
  followMode: boolean
  hideTime: boolean
  lineCount: number
  levelFilter: string
}

export type UISettings = {
  detailPanelWidth: number
  librarySidebarWidth: number
  bookView: BookView
  listVisibleColumns: DisplayField[]
  // the fields shown below a grid cover. null = auto (derived from sort/filter);
  // an explicit array (possibly empty = show nothing) is the user's own choice.
  gridDisplayFields: DisplayField[] | null
  logDisplay: LogDisplayPrefs
}

const COOKIE_NAME = "st-ui"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const defaultLogDisplay: LogDisplayPrefs = {
  wrapLines: false,
  highlighting: true,
  followMode: true,
  hideTime: false,
  lineCount: 500,
  levelFilter: "all",
}

const defaultListVisibleColumns: DisplayField[] = [
  "authors",
  "duration",
  "pageCount",
]

const defaults: UISettings = {
  detailPanelWidth: 420,
  librarySidebarWidth: 280,
  bookView: "grid",
  listVisibleColumns: defaultListVisibleColumns,
  gridDisplayFields: null,
  logDisplay: defaultLogDisplay,
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

export const loadUISettingsFromStorage = (): Partial<UISettings> | null => {
  if (typeof window === "undefined") return null

  const fromCookie = loadUISettingsFromCookie()
  if (fromCookie) return fromCookie

  try {
    const stored = localStorage.getItem("ui-settings")
    if (!stored) return null

    const parsed = JSON.parse(stored) as Partial<UISettings>

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
      const merged = { ...defaults, ...state, ...action.payload }

      merged.logDisplay = {
        ...defaultLogDisplay,
        ...merged.logDisplay,
      }

      // backwards compat: cookies that predate the rename
      const legacy = action.payload as Record<string, unknown>
      if (
        !merged.listVisibleColumns.length &&
        Array.isArray(legacy["listVisibleFields"])
      ) {
        merged.listVisibleColumns = legacy[
          "listVisibleFields"
        ] as DisplayField[]
      }

      if (merged.listVisibleColumns.length === 0) {
        merged.listVisibleColumns = defaultListVisibleColumns
      }

      return merged
    },

    setDetailPanelWidth: (state, action: PayloadAction<number>) => {
      state.detailPanelWidth = action.payload
      saveToCookie(state)
    },

    setLibrarySidebarWidth: (state, action: PayloadAction<number>) => {
      state.librarySidebarWidth = action.payload
      saveToCookie(state)
    },

    setBookView: (state, action: PayloadAction<BookView>) => {
      state.bookView = action.payload
      saveToCookie(state)
    },

    setListVisibleColumns: (state, action: PayloadAction<DisplayField[]>) => {
      state.listVisibleColumns = action.payload
      saveToCookie(state)
    },

    setGridDisplayFields: (
      state,
      action: PayloadAction<DisplayField[] | null>,
    ) => {
      state.gridDisplayFields = action.payload
      saveToCookie(state)
    },

    setLogDisplayPrefs: (
      state,
      action: PayloadAction<Partial<LogDisplayPrefs>>,
    ) => {
      state.logDisplay = { ...state.logDisplay, ...action.payload }
      saveToCookie(state)
    },
  },
})

export const uiSettingsReducer = uiSettingsSlice.reducer

export const selectDetailPanelWidth = (state: { uiSettings: UISettings }) =>
  state.uiSettings.detailPanelWidth

export const selectLibrarySidebarWidth = (state: { uiSettings: UISettings }) =>
  state.uiSettings.librarySidebarWidth

export const selectBookView = (state: { uiSettings: UISettings }) =>
  state.uiSettings.bookView

export const selectListVisibleColumns = (state: { uiSettings: UISettings }) =>
  state.uiSettings.listVisibleColumns

export const selectGridDisplayFields = (state: { uiSettings: UISettings }) =>
  state.uiSettings.gridDisplayFields

export const selectLogDisplayPrefs = (state: { uiSettings: UISettings }) =>
  state.uiSettings.logDisplay
