import { useTheme } from "next-themes"

import { type JsColor } from "@storyteller-platform/okmain"

import { type BookWithRelations } from "@/database/books"

export type CoverColors = {
  background: string
  accent: string
  contrast: string
}

export function useCoverColors(colors: JsColor[]): CoverColors[]
export function useCoverColors(
  book: BookWithRelations,
  type?: "ebook" | "audiobook" | "readaloud",
): CoverColors[]
export function useCoverColors(
  bookOrColors: BookWithRelations | JsColor[],
  type?: "ebook" | "audiobook" | "readaloud",
): CoverColors[] {
  const { resolvedTheme } = useTheme()
  const colors =
    (Array.isArray(bookOrColors)
      ? bookOrColors
      : type
        ? bookOrColors[type]?.coverColors
        : (bookOrColors.ebook?.coverColors ??
          bookOrColors.audiobook?.coverColors ??
          bookOrColors.readaloud?.coverColors)) ?? []

  const cc = colors.map((color) => {
    const opacity = resolvedTheme === "dark" ? 0.6 : 0.4
    return {
      background: `rgba(${Object.values(color).join(",")}, ${opacity})`,
      accent: `rgba(${Object.values(color).join(",")})`,
      // taken from https://piccalil.li/blog/some-css-only-contrast-options-until-contrast-color-is-baseline-widely-available/
      // as a decent substitute until color-contrast() is baseline
      contrast: `calc(((((${color.r} * 299) + (${color.g} * 587) + (${color.b} * 114)) / 1000) - 128) * -1000)`,
    }
  })

  return cc
}
