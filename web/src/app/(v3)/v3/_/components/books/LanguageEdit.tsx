"use client"

import { IconCheck } from "@tabler/icons-react"
import { useLocale } from "next-intl"
import { useMemo, useState } from "react"
import { useWatch } from "react-hook-form"

import { Input } from "@v3/_/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@v3/_/components/ui/popover"

import { cn } from "@/cn"

import { useBookForm } from "./BookDetails/BookFormProvider"
import { SEAMLESS_BOX } from "./BookDetails/EditableText"

// a reasonable spread of ISO 639-1 codes; the localized labels come from
// Intl.DisplayNames so we only have to keep the codes themselves around.
const LANGUAGE_CODES = [
  "en",
  "nl",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "pt-BR",
  "ru",
  "uk",
  "pl",
  "cs",
  "sk",
  "hu",
  "ro",
  "el",
  "tr",
  "sv",
  "no",
  "da",
  "fi",
  "is",
  "ga",
  "cy",
  "ca",
  "eu",
  "gl",
  "ar",
  "he",
  "fa",
  "ur",
  "hi",
  "bn",
  "ta",
  "te",
  "ml",
  "mr",
  "gu",
  "pa",
  "th",
  "vi",
  "id",
  "ms",
  "tl",
  "zh",
  "zh-Hans",
  "zh-Hant",
  "ja",
  "ko",
  "sw",
  "af",
  "zu",
  "am",
  "lt",
  "lv",
  "et",
  "sl",
  "hr",
  "sr",
  "bg",
  "mk",
  "sq",
  "ka",
  "hy",
  "kk",
  "uz",
  "az",
  "la",
] as const

type LanguageInfo = {
  // the localized display name in the user's locale, e.g. "Dutch"
  displayName: string | null
  // the maximized BCP-47 tag, e.g. "nl-Latn-NL"
  maximized: string | null
}

function describeLanguage(code: string, locale: string): LanguageInfo {
  const trimmed = code.trim()
  if (!trimmed) return { displayName: null, maximized: null }

  try {
    const parsed = new Intl.Locale(trimmed)
    const maximized = parsed.maximize().toString()
    const displayNames = new Intl.DisplayNames([locale], {
      type: "language",
      languageDisplay: "dialect",
    })
    return {
      displayName: displayNames.of(trimmed) ?? null,
      maximized,
    }
  } catch {
    return { displayName: null, maximized: null }
  }
}

export function LanguageEdit() {
  const {
    form,
    canEdit,
    isEditing,
    editingField,
    setEditingField,
    commitField,
  } = useBookForm()
  const locale = useLocale()

  const language = useWatch({ control: form.control, name: "language" }) ?? ""
  const active = canEdit && (isEditing || editingField === "language")

  const [search, setSearch] = useState("")

  // precompute localized labels once per render-locale so filtering is cheap
  const options = useMemo(
    () =>
      LANGUAGE_CODES.map((code) => ({
        code,
        label: describeLanguage(code, locale).displayName ?? code,
      })),
    [locale],
  )

  const current = describeLanguage(language, locale)

  // what the user is currently typing maps to a candidate locale; lets the
  // preview validate free-form codes that aren't in the curated list.
  const candidate = describeLanguage(search, locale)
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(term) ||
        o.code.toLowerCase().includes(term),
    )
  }, [options, search])

  const open = (next: boolean) => {
    if (next) {
      setSearch("")
      setEditingField("language")
    } else if (editingField === "language") {
      setEditingField(null)
    }
  }

  const select = (code: string) => {
    form.setValue("language", code, { shouldDirty: true })
    void commitField("language")
  }

  const trigger = (
    <button
      type="button"
      disabled={!canEdit}
      className={cn(
        SEAMLESS_BOX,
        "block w-fit border-transparent text-left text-sm",
        canEdit && "hover:border-input hover:bg-input/10 cursor-pointer",
        !language && "text-muted-foreground italic",
      )}
    >
      {current.displayName ?? (language || "Add language")}
    </button>
  )

  if (!canEdit) {
    return (
      <span
        className={cn("text-sm", !language && "text-muted-foreground italic")}
        title={current.maximized ?? undefined}
      >
        {current.displayName ?? (language || "—")}
      </span>
    )
  }

  return (
    <Popover open={active} onOpenChange={open}>
      <PopoverTrigger render={trigger} />
      <PopoverContent className="w-64 gap-0 p-2" align="start">
        <Input
          autoFocus
          placeholder="Search or type a code (e.g. en, pt-BR)"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && candidate.maximized) {
              e.preventDefault()
              select(search.trim())
            }
          }}
        />

        <div
          className={cn(
            "px-1 py-1.5 text-xs",
            candidate.maximized ? "text-muted-foreground" : "text-destructive",
          )}
        >
          {search.trim() ? (
            candidate.maximized ? (
              <>
                {candidate.displayName ?? search.trim()}
                <span className="text-muted-foreground/70">
                  {" · "}
                  {candidate.maximized}
                </span>
              </>
            ) : (
              "Not a valid language code"
            )
          ) : current.maximized ? (
            <>
              Current: {current.displayName}
              <span className="text-muted-foreground/70">
                {" · "}
                {current.maximized}
              </span>
            </>
          ) : (
            "No language set"
          )}
        </div>

        <div className="scroll-y flex max-h-56 flex-col gap-0.5">
          {filtered.map((o) => (
            <button
              key={o.code}
              type="button"
              onClick={() => {
                select(o.code)
              }}
              className="hover:bg-accent flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs"
            >
              <span className="flex items-center gap-1.5">
                {o.code === language && <IconCheck className="size-3" />}
                {o.label}
              </span>
              <span className="text-muted-foreground/70 tabular-nums">
                {o.code}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <span className="text-muted-foreground px-2 py-2 text-center text-xs">
              No matches
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
