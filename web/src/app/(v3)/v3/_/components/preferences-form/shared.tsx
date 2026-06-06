"use client"

import { type ReactNode, createContext, useContext } from "react"
import { type UseFormReturn } from "react-hook-form"
import { type z } from "zod"

import { Button } from "@v3/_/components/ui/button"
import { cn } from "@v3/_/lib/utils"

import { type UserPreferencesSchema } from "@/database/userPreferencesTypes"

import { type Tab } from "./tabs"

export type PreferencesFormType = UseFormReturn<
  z.infer<typeof UserPreferencesSchema>
>

export type IsMatch = (tab: Tab, section: string) => boolean

export type SearchContextValue = {
  query: string
  isMatch: IsMatch
}

export const SearchContext = createContext<SearchContextValue>({
  query: "",
  isMatch: () => false,
})

// wraps a settings section so it hides when a search doesn't match it and
// gets a ring highlight when it does (mirrors settings-form's SettingsSection)
export function PreferencesSection({
  tab,
  section,
  children,
}: {
  tab: Tab
  section: string
  children: ReactNode
}) {
  const { query, isMatch } = useContext(SearchContext)
  const matches = isMatch(tab, section)

  if (query && !matches) return null

  return (
    <div
      className={cn(
        query && matches && "ring-primary/50 rounded-lg ring-1 ring-offset-0",
      )}
    >
      {children}
    </div>
  )
}

// a small single-select segmented control for enum-style preferences
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<{ value: T; label: string }>
}) {
  return (
    <div className="bg-muted inline-flex w-fit rounded-md p-0.5">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "default" : "ghost"}
          className={cn(
            "h-7 rounded-[min(var(--radius-md),8px)]",
            value !== option.value && "text-muted-foreground",
          )}
          onClick={() => {
            onChange(option.value)
          }}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
