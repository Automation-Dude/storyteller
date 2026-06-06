import { useMemo } from "react"

import { type JsColor } from "@storyteller-platform/okmain"

import { useUserPreferences } from "@v3/_/components/user-preferences-provider"

import { type BookWithRelations } from "@/database/books"
import { type ColorMode } from "@/database/userPreferencesTypes"

export type CoverColor = {
  rgb: { r: number; g: number; b: number }
  // perceived luminance, 0-255
  luminance: number
  isDark: boolean
  // "rgb(r,g,b)"
  solid: string
  // "rgba(r,g,b,a)" at the given opacity
  alpha: (a: number) => string
  // readable text color to sit on top of solid
  onColor: string
}

export type CoverColors = {
  primary: CoverColor
  // highest-contrast swatch vs primary, falls back to primary
  accent: CoverColor
  // every swatch in source order
  palette: CoverColor[]
}

type CoverType = "ebook" | "audiobook" | "readaloud"

function luminance(color: JsColor): number {
  return Math.round(color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722)
}

// crude contrast ratio between two luminance values (0-255 scale)
export function contrastRatio(a: number, b: number): number {
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

function toCoverColor(color: JsColor): CoverColor {
  const { r, g, b } = color
  const lum = luminance(color)
  return {
    rgb: { r, g, b },
    luminance: lum,
    isDark: lum < 128,
    solid: `rgb(${r}, ${g}, ${b})`,
    alpha: (a: number) => `rgba(${r}, ${g}, ${b}, ${a})`,
    onColor: lum < 128 ? "#fff" : "#000",
  }
}

const FALLBACK: CoverColor = {
  rgb: { r: 0, g: 0, b: 0 },
  luminance: 0,
  isDark: true,
  solid: "var(--primary)",
  alpha: (a: number) =>
    `color-mix(in srgb, var(--primary) ${a * 100}%, transparent)`,
  onColor: "var(--primary-foreground)",
}

const FALLBACK_COLORS: CoverColors = {
  primary: FALLBACK,
  accent: FALLBACK,
  palette: [FALLBACK],
}

function resolveColors(
  bookOrColors: BookWithRelations | JsColor[],
  type?: CoverType,
): JsColor[] {
  if (Array.isArray(bookOrColors)) return bookOrColors
  if (type) return bookOrColors[type]?.coverColors ?? []
  return (
    bookOrColors.ebook?.coverColors ??
    bookOrColors.audiobook?.coverColors ??
    bookOrColors.readaloud?.coverColors ??
    []
  )
}

export function useCoverColors(colors: JsColor[]): CoverColors
export function useCoverColors(
  book: BookWithRelations | undefined,
  options?: { type?: CoverType },
): CoverColors
export function useCoverColors(
  bookOrColors: BookWithRelations | JsColor[] | undefined,
  options?: { type?: CoverType },
): CoverColors {
  const type = options?.type

  return useMemo(() => {
    const colors = bookOrColors ? resolveColors(bookOrColors, type) : []
    const [primary, ...rest] = colors.map(toCoverColor)
    if (!primary) return FALLBACK_COLORS

    // pick the swatch that reads most distinctly against the primary
    const accent = rest.reduce((best, candidate) => {
      const ratio = contrastRatio(candidate.luminance, primary.luminance)
      const bestRatio = contrastRatio(best.luminance, primary.luminance)
      return ratio > 2 && ratio > bestRatio ? candidate : best
    }, primary)

    return { primary, accent, palette: [primary, ...rest] }
  }, [bookOrColors, type])
}

export type ColorPreferences = {
  level: ColorMode
  intensity: number
  // ambient background tints (card bg, panel header, hero) apply at medium+
  showTint: boolean
  // strong ui coloring (--primary overrides, hover tints, colored buttons /
  // badges) applies at full only
  showAccent: boolean
  // a tint alpha scaled by intensity; "transparent" when tints are off
  tint: (color: CoverColor, base: number) => string
}

// reads how colorful the app should be (set in preferences) and turns it into
// flags + a helper the cover-color consumers use to gate / scale their tints
export function useColorPreferences(): ColorPreferences {
  const { colorMode, colorIntensity } = useUserPreferences()

  return useMemo(() => {
    const showTint = colorMode !== "minimal"
    return {
      level: colorMode,
      intensity: colorIntensity,
      showTint,
      showAccent: colorMode === "full",
      tint: (color, base) =>
        showTint ? color.alpha(base * colorIntensity) : "transparent",
    }
  }, [colorMode, colorIntensity])
}
