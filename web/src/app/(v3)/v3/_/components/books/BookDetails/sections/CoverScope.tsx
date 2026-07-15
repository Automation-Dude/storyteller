"use client"

import { useMemo } from "react"

import { type BookWithRelations } from "@/database/books"

import {
  type CoverColor,
  type CoverType,
  ensureContrast,
  useColorPreferences,
  useCoverColors,
  useIsDarkMode,
} from "./useCoverColors"

// space-separated channels, "r g b", for css rgb(var(--x) / a) and
// color-mix(rgb(var(--x)) ...) expressions
function channels(color: CoverColor): string {
  const { r, g, b } = color.rgb
  return `${r} ${g} ${b}`
}

// props to spread onto an element to open a cover-color scope: the semantic
// tokens (--tint, --tinted-foreground, --cover-accent, ...) resolve from these
// under the [data-cover-*] rules in globals.css. spreading avoids an extra dom
// node; use <CoverScope> when a plain wrapper is fine.
export type CoverScopeProps = {
  style: React.CSSProperties
  "data-cover-tint"?: ""
  "data-cover-accent"?: ""
}

// derive the scope props for a book. stays neutral (no data attrs, theme
// primary) when the book has no extracted colors or the user's color mode is
// minimal, so consumers use the utility classes unconditionally.
export function useCoverScope(
  book: BookWithRelations | undefined,
  options?: { type?: CoverType; style?: React.CSSProperties },
): CoverScopeProps {
  const { primary, accent, hasColors } = useCoverColors(book, {
    type: options?.type,
  })
  const { level, intensity } = useColorPreferences()
  const isDark = useIsDarkMode()
  const extraStyle = options?.style

  return useMemo(() => {
    if (!hasColors) return { style: { ...extraStyle } }

    const cPrimary = ensureContrast(primary, isDark)
    const cAccent = ensureContrast(accent, isDark)
    const showTint = level !== "minimal"
    const showAccent = level === "full"

    // tints always blend toward the theme surface (--cover-background-mix
    // defaults to var(--background)); the old vibrant/subdued white-mix split
    // washed out in light mode and is gone.
    const vars: Record<string, string | number> = {
      "--cover-rgb": channels(primary),
      "--cover-solid-rgb": cPrimary.channels,
      "--cover-accent-rgb": channels(accent),
      "--cover-accent-solid-rgb": cAccent.channels,
      "--cover-intensity": intensity,
    }

    // in full mode override --primary so generic bg-primary / text-primary
    // recolor to the cover (buttons, status, primary chrome) — this is the
    // "full = cover everywhere" switch, centralized here instead of scattered.
    // --cover-primary follows via its var(--primary) default; the accent swatch
    // is distinct so it's set explicitly. these need the ensureContrast lightness
    // loop css can't do, hence inline rather than derived under [data-cover-accent].
    if (showAccent) {
      vars["--primary"] = cPrimary.solid
      vars["--primary-foreground"] = cPrimary.onColor
      vars["--cover-accent-color"] = cAccent.solid
      vars["--cover-accent-foreground"] = cAccent.onColor
    }

    return {
      style: { ...vars, ...extraStyle } as React.CSSProperties,
      ...(showTint ? { "data-cover-tint": "" as const } : {}),
      ...(showAccent ? { "data-cover-accent": "" as const } : {}),
    }
  }, [primary, accent, hasColors, level, intensity, isDark, extraStyle])
}

// wrapper form of useCoverScope for cases where an extra element is fine.
export function CoverScope({
  book,
  type,
  className,
  style,
  children,
}: {
  book: BookWithRelations | undefined
  type?: CoverType
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const scope = useCoverScope(book, { type, style })
  return (
    <div className={className} {...scope}>
      {children}
    </div>
  )
}
