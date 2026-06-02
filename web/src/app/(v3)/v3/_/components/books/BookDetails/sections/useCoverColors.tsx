import { useTheme } from "next-themes"

import { type JsColor } from "@storyteller-platform/okmain"

import { type BookWithRelations } from "@/database/books"

export type CoverColor = {
  background: string
  accent: string
  contrast: string
}

export type CoverColors = {
  primary: CoverColor
  others: CoverColor[]
}

const getContrast = (color: JsColor) => {
  return (
    Math.round(color.r * 0.2126) +
    Math.round(color.g * 0.7152) +
    Math.round(color.b * 0.0722)
  )
}

export function useCoverColors(
  colors: JsColor[],
  options?: { opacity?: number },
): CoverColors
export function useCoverColors(
  book: BookWithRelations,
  options?: { opacity?: number; type?: "ebook" | "audiobook" | "readaloud" },
): CoverColors
export function useCoverColors(
  bookOrColors: BookWithRelations | JsColor[],
  options?: { opacity?: number; type?: "ebook" | "audiobook" | "readaloud" },
): CoverColors {
  const { resolvedTheme } = useTheme()
  const colors =
    (Array.isArray(bookOrColors)
      ? bookOrColors
      : options?.type
        ? bookOrColors[options.type]?.coverColors
        : bookOrColors.ebook?.coverColors ??
          bookOrColors.audiobook?.coverColors ??
          bookOrColors.readaloud?.coverColors) ?? []

  const baseOpacity = options?.opacity ?? 0.6
  const opacity = resolvedTheme === "dark" ? baseOpacity : baseOpacity * 0.6

  const colorsWithContrast = colors.map((color) => ({
    color,
    contrast: getContrast(color),
  }))
  const primaryContrast = colorsWithContrast[0].contrast

  const contrastWithPrimary = colorsWithContrast.map((color, index) => {
    if (index === 0) return { ...color, contrastWithPrimary: 1 }

    const lighter =
      color.contrast > primaryContrast ? color.contrast : primaryContrast
    const darker =
      color.contrast < primaryContrast ? color.contrast : primaryContrast
    return { ...color, contrastWithPrimary: (lighter + 0.05) / (darker + 0.05) }
  })

  const cc = contrastWithPrimary.map(
    ({ color, contrast, contrastWithPrimary }) => {
      return {
        background: `rgba(${Object.values(color).join(",")}, ${opacity})`,
        accent: `rgba(${Object.values(color).join(",")})`,
        contrast: contrast <= 128 ? "white" : "black",
        _contrast: contrast,
        _contrastWithPrimary: contrastWithPrimary,
      }
    },
  )

  const firstWithHighContrast = cc.reduce(
    (acc, curr) => {
      if (
        curr._contrastWithPrimary > acc._contrastWithPrimary &&
        curr._contrastWithPrimary > 2
      ) {
        return {
          accent: curr.accent,
          _contrastWithPrimary: curr._contrastWithPrimary,
        }
      }
      return acc
    },
    { accent: "", _contrastWithPrimary: 1 },
  )

  return {
    primary: cc[0]
      ? { ...cc[0], contrast: firstWithHighContrast.accent || cc[0].contrast }
      : {
          background: "var(--primary)",
          accent: "var(--primary)",
          contrast: "var(--primary-foreground)",
        },
    others: cc.slice(1),
  }
}
