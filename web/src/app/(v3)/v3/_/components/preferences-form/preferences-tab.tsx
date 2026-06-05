"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import { type z } from "zod"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@v3/_/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@v3/_/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v3/_/components/ui/select"
import { TabsContent } from "@v3/_/components/ui/tabs"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type UserPreferencesSchema } from "@/database/userPreferencesTypes"
import { locales } from "@/i18n/locales"

type PreferencesFormType = UseFormReturn<z.infer<typeof UserPreferencesSchema>>

const readingModeOptions = [
  { value: "readaloud", label: "Read-aloud (synced audio + text)" },
  { value: "audiobook", label: "Audiobook" },
  { value: "epub", label: "E-book" },
]

const localeOptions = Object.entries(locales).map(([key, locale]) => ({
  value: key,
  label: `${locale.flag} ${locale.label}`,
}))

export function PreferencesTab({ form }: { form: PreferencesFormType }) {
  const t = useTranslation("PreferencesPage.preferences")

  return (
    <TabsContent value="preferences" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("language.title")}</CardTitle>
          <CardDescription>{t("language.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Controller
            name="locale"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel>{t("language.label")}</FieldLabel>
                <FieldDescription>{t("language.hint")}</FieldDescription>
                <Select
                  items={localeOptions}
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    field.onChange(value || null)
                  }}
                >
                  <SelectTrigger className="w-60">
                    <SelectValue placeholder={t("language.systemDefault")} />
                  </SelectTrigger>
                  <SelectContent>
                    {localeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("reading.title")}</CardTitle>
          <CardDescription>{t("reading.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Controller
            name="defaultReadingMode"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel>{t("reading.label")}</FieldLabel>
                <FieldDescription>{t("reading.hint")}</FieldDescription>
                <Select
                  items={readingModeOptions}
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    field.onChange(value || null)
                  }}
                >
                  <SelectTrigger className="w-60">
                    <SelectValue placeholder={t("reading.automatic")} />
                  </SelectTrigger>
                  <SelectContent>
                    {readingModeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </CardContent>
      </Card>
    </TabsContent>
  )
}
