"use client"

import {
  type ReactNode,
  createContext,
  useContext,
  useMemo,
  useState,
} from "react"
import { type Control, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { FieldLabel } from "@v3/_/components/ui/field"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@v3/_/components/ui/tooltip"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import {
  type OrgDefaultKey as LibraryDefaultKey,
  type PreferenceDefaults,
  type UserPreferences,
} from "@/database/userPreferencesTypes"
import * as icon from "@/icons"
import { useUpdatePreferenceDefaultsMutation } from "@/store/api"

import { TooltipButton } from "../ui/tooltip-button"

type LibraryDefaultsContextValue = {
  control: Control<UserPreferences>
  canManage: boolean
  locked: boolean
  savedDefaults: PreferenceDefaults
  setSavedDefaults: (defaults: PreferenceDefaults) => void
}

const LibraryDefaultsContext =
  createContext<LibraryDefaultsContextValue | null>(null)

export function LibraryDefaultsProvider({
  control,
  canManage,
  locked,
  defaults,
  children,
}: {
  control: Control<UserPreferences>
  canManage: boolean
  locked: boolean
  defaults: PreferenceDefaults
  children: ReactNode
}) {
  const [savedDefaults, setSavedDefaults] =
    useState<PreferenceDefaults>(defaults)

  const value = useMemo<LibraryDefaultsContextValue>(
    () => ({ control, canManage, locked, savedDefaults, setSavedDefaults }),
    [control, canManage, locked, savedDefaults],
  )

  return (
    <LibraryDefaultsContext.Provider value={value}>
      {children}
    </LibraryDefaultsContext.Provider>
  )
}

export function useLibraryDefaultValue<K extends LibraryDefaultKey>(
  field: K,
): PreferenceDefaults[K] | null {
  const ctx = useContext(LibraryDefaultsContext)
  return ctx?.savedDefaults[field] ?? null
}

export function LibraryDefault({ field }: { field: LibraryDefaultKey }) {
  const ctx = useContext(LibraryDefaultsContext)
  const t = useTranslation("PreferencesPage.libraryDefault")
  const [update, { isLoading }] = useUpdatePreferenceDefaultsMutation()
  const value = useWatch({ control: ctx?.control, name: field })

  if (!ctx || !ctx.canManage) return null

  if (ctx.locked) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <icon.Lock className="size-3" />
              {t("locked")}
            </span>
          }
        />
        <TooltipContent>{t("lockedHint")}</TooltipContent>
      </Tooltip>
    )
  }

  const saved = ctx.savedDefaults[field]
  const isCurrent =
    JSON.stringify(saved ?? null) === JSON.stringify(value ?? null)

  const onClick = async () => {
    if (isCurrent || isLoading) return
    try {
      const merged = await update({ [field]: value }).unwrap()
      ctx.setSavedDefaults(merged)
      toast.success(t("saved"))
    } catch {
      toast.error(t("failed"))
    }
  }

  return (
    <TooltipButton
      type="button"
      variant="ghost"
      size="sm"
      disabled={isLoading || isCurrent}
      onClick={onClick}
      className={cn(
        "text-muted-foreground h-6 shrink-0 gap-1.5 px-1.5 text-xs font-normal",
        isCurrent && "opacity-70",
      )}
      tooltip={isCurrent ? t("isDefault") : t("setAsDefault")}
      aria-label={isCurrent ? t("isDefault") : t("setAsDefault")}
    >
      {isCurrent ? (
        <icon.Check className="size-3.5" />
      ) : (
        <icon.Settings className="size-3.5" />
      )}
    </TooltipButton>
  )
}

export function SettingLabel({
  field,
  children,
  className,
}: {
  field?: LibraryDefaultKey
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-6 items-center justify-between gap-2",
        className,
      )}
    >
      <FieldLabel>{children}</FieldLabel>
      {field ? <LibraryDefault field={field} /> : null}
    </div>
  )
}
