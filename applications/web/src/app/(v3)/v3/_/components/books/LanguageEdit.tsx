"use client"

import { useLocale } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { useWatch } from "react-hook-form"

import { cn } from "@/cn"

import { useBookForm } from "./BookDetails/BookFormProvider"
import { SEAMLESS_BOX } from "./BookDetails/EditableText"
import { InlineFieldChrome } from "./BookDetails/InlineEditChrome"

type Size = { width: number; height: number } | null

function measure(el: HTMLElement | null): Size {
  const rect = el?.getBoundingClientRect()
  return rect ? { width: rect.width, height: rect.height } : null
}

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
  const inlineMode = editingField === "language" && !isEditing

  const inputRef = useRef<HTMLInputElement>(null)
  const displayRef = useRef<HTMLButtonElement>(null)
  const [size, setSize] = useState<Size>(null)

  useEffect(() => {
    if (inlineMode) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [inlineMode])

  const info = describeLanguage(language, locale)

  if (!canEdit) {
    return (
      <span
        className={cn("text-sm", !language && "text-muted-foreground italic")}
        title={info.maximized ?? undefined}
      >
        {info.displayName ?? (language || "—")}
      </span>
    )
  }

  if (!active) {
    return (
      <button
        ref={displayRef}
        type="button"
        onClick={() => {
          setSize(measure(displayRef.current))
          setEditingField("language")
        }}
        className={cn(
          SEAMLESS_BOX,
          "py-0",
          "block w-fit border-transparent text-left text-sm",
          "hover:border-input hover:bg-input/10 cursor-pointer",
          !language && "text-muted-foreground italic",
        )}
      >
        {info.displayName ?? (language || "Add language")}
      </button>
    )
  }

  const commit = () => {
    if (!inlineMode) return
    // an empty or valid code commits; a non-empty invalid one reverts so we
    // never persist garbage.
    if (!language.trim() || info.maximized) {
      void commitField("language")
    } else {
      form.resetField("language")
      setEditingField(null)
    }
  }

  const editor = (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        value={language}
        placeholder="e.g. en, pt-BR, zh-Hans"
        onChange={(e) => {
          form.setValue("language", e.target.value, { shouldDirty: true })
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          }
          if (e.key === "Escape") {
            e.preventDefault()
            form.resetField("language")
            setEditingField(null)
          }
        }}
        className={cn(
          "text-sm outline-none",
          inlineMode
            ? // bare inside the floating chrome, which supplies the frame
              "border-input focus-visible:border-ring w-full border-0 border-b border-dashed bg-transparent px-0 py-0.5"
            : cn(
                SEAMLESS_BOX,
                "border-input bg-input/20 dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/30 w-40 focus-visible:ring-2",
              ),
        )}
      />

      {/* preview only what the code widens to -- no curated list */}
      <div
        className={cn(
          "text-xs",
          !language.trim()
            ? "text-muted-foreground"
            : info.maximized
              ? "text-muted-foreground"
              : "text-destructive",
        )}
      >
        {!language.trim() ? (
          "No language set"
        ) : info.maximized ? (
          <>
            {info.displayName ?? language.trim()}
            <span className="text-muted-foreground/70">
              {" · "}
              {info.maximized}
            </span>
          </>
        ) : (
          "Not a valid language code"
        )}
      </div>
    </div>
  )

  // global edit mode keeps the boxed input in flow; single-field inline edit
  // floats the shared chrome over the value.
  if (!inlineMode) return editor

  return (
    <InlineFieldChrome name="language" size={size} inline>
      {editor}
    </InlineFieldChrome>
  )
}
