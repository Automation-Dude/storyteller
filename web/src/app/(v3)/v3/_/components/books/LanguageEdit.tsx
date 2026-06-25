import { useEffect, useState } from "react"
import { useBookForm } from "./BookDetails/BookFormProvider"
import { useWatch } from "react-hook-form"
import { Input } from "../ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "../ui/combobox"
import { cn } from "@/cn"

const getLocaleInfo = (language: string) => {
  try {
    return new Intl.Locale(language).maximize()
  } catch {
    return null
  }
}

export function LanguageEdit() {
  const { book, form } = useBookForm()
  const language = useWatch({ control: form.control, name: "language" })
  const [maximizedLanguage, setMaximizedLanguage] = useState(
    language ? getLocaleInfo(language)?.toString() : null,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (language) {
      const info = getLocaleInfo(language)
      if (info) {
        setError(null)
        setMaximizedLanguage(info.toString())
      } else {
        setError("Invalid language code")
      }
    }
  }, [language])

  return (
    <Combobox>
      <ComboboxInput
        type="text"
        showTrigger={false}
        value={language ?? ""}
        onChange={(e) => {
          form.setValue("language", e.target.value)
        }}
      />
      <ComboboxContent>
        <ComboboxList>
          <ComboboxItem disabled className={cn(error && "text-destructive")}>
            {error
              ? error
              : maximizedLanguage
                ? `Interpreted as: ${maximizedLanguage}`
                : "No interpretation available"}
          </ComboboxItem>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
