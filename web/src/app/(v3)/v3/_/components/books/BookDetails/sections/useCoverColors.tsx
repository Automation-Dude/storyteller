import { useTheme } from "next-themes"
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
  // false when the book has no extracted colors and primary/accent are the
  // theme-primary fallback (consumers should stay neutral rather than tint)
  hasColors: boolean
}

export type CoverType = "ebook" | "audiobook" | "readaloud"

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
  hasColors: false,
}

function resolveColors(
  bookOrColors: BookWithRelations | JsColor[],
  type?: CoverType,
): JsColor[] {
  if (Array.isArray(bookOrColors)) return bookOrColors
  // a per-format query wants that format's real colors, never the override
  if (type) return bookOrColors[type]?.coverColors ?? []
  return (
    bookOrColors.coverColorsOverride ??
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

    return { primary, accent, palette: [primary, ...rest], hasColors: true }
  }, [bookOrColors, type])
}

// the surface a cover-derived accent has to read against, as a luminance on the
// same 0-255 scale used above. light mode is near-white, dark mode near-black.
const LIGHT_SURFACE = 250
const DARK_SURFACE = 28
// modest target: enough for a ui accent / large text without forcing every
// color to near-black or near-white.
const MIN_CONTRAST = 3.2

function clamp8(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

export type ContrastColor = {
  // the (possibly adjusted) color, "rgb(r,g,b)"
  solid: string
  // the same color as space-separated channels, "r g b", for use in css
  // rgb(var(--x) / a) and color-mix(rgb(var(--x)) ...) expressions
  channels: string
  // readable text/icon color to sit on top of solid
  onColor: string
}

// take a cover color and nudge its lightness until it reads with enough contrast
// against the active surface: darken in light mode, lighten in dark mode. this
// replaces the old "fall back to the theme orange when the color is too light"
// behavior -- we keep the cover's hue and just move it far enough to be legible.
export function ensureContrast(
  color: CoverColor,
  isDarkMode: boolean,
): ContrastColor {
  const surface = isDarkMode ? DARK_SURFACE : LIGHT_SURFACE
  let { r, g, b } = color.rgb

  const lum = () => r * 0.2126 + g * 0.7152 + b * 0.0722

  for (let i = 0; i < 16; i++) {
    if (contrastRatio(lum(), surface) >= MIN_CONTRAST) break

    if (isDarkMode) {
      // step toward white
      r = clamp8(r + (255 - r) * 0.12)
      g = clamp8(g + (255 - g) * 0.12)
      b = clamp8(b + (255 - b) * 0.12)
    } else {
      // step toward black
      r = clamp8(r * 0.85)
      g = clamp8(g * 0.85)
      b = clamp8(b * 0.85)
    }
  }

  return {
    solid: `rgb(${r}, ${g}, ${b})`,
    channels: `${r} ${g} ${b}`,
    onColor: lum() < 140 ? "#fff" : "#000",
  }
}

// resolved light/dark mode for cover-color contrast decisions. undefined during
// the first client render (before next-themes resolves) reads as light.
export function useIsDarkMode(): boolean {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === "dark"
}

export type ColorPreferences = {
  level: ColorMode
  intensity: number
  colorMix: "vibrant" | "subdued"
  // ambient background tints (card bg, panel header, hero) apply at medium+
  showTint: boolean
  // strong ui coloring (--primary overrides, hover tints, colored buttons /
  // badges) applies at full only
  showAccent: boolean
  // a tint alpha scaled by intensity; "transparent" when tints are off
  tint: (color: CoverColor, base: number) => string
}

export function useColorPreferences(): ColorPreferences {
  const { colorMode, colorIntensity, colorMix } = useUserPreferences()

  return useMemo(() => {
    const showTint = colorMode !== "minimal"
    return {
      level: colorMode,
      colorMix,
      intensity: colorIntensity,
      showTint,
      showAccent: colorMode === "full",
      tint: (color, base) =>
        showTint ? color.alpha(base * colorIntensity) : "transparent",
    }
  }, [colorMode, colorIntensity, colorMix])
}
