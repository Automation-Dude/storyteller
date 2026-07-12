"use client"

import { useReducedMotion } from "motion/react"

import { useUserPreferences } from "@v3/_/components/user-preferences-provider"

// whether the animated layout model (panel slide, grid FLIP, magnetic resize)
// is active. either the user preference or the OS reduced-motion setting turns
// it off, falling back to the instant-snap behavior.
export function useLayoutAnimations(): boolean {
  const { layoutAnimations } = useUserPreferences()
  // null during ssr/first render: treat as not reduced
  const reducedMotion = useReducedMotion()
  return layoutAnimations && !reducedMotion
}
