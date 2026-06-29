"use client"

import { Controller } from "react-hook-form"

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
import { useTranslation } from "@v3/_/hooks/use-translation"

import { ViewKinds } from "@/database/userPreferencesTypes"
import { locales } from "@/i18n/locales"

import { type PreferencesFormType, PreferencesSection } from "./shared"

const localeOptions = Object.entries(locales).map(([key, locale]) => ({
  value: key,
  label: `${locale.flag} ${locale.label}`,
}))

export function GeneralTab({ form }: { form: PreferencesFormType }) {
  const t = useTranslation("PreferencesPage.tabs.general.sections")

  const readingModeOptions = [
    { value: "readaloud", label: t("reading.modes.readaloud") },
    { value: "audiobook", label: t("reading.modes.audiobook") },
    { value: "epub", label: t("reading.modes.epub") },
  ]

  const viewOptions = ViewKinds.map((key) => ({
    value: key,
    label: t(`view.kinds.${key}`),
  }))

  return (
    <div className="space-y-6">
      <PreferencesSection tab="general" section="language">
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
      </PreferencesSection>

      <PreferencesSection tab="general" section="reading">
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
      </PreferencesSection>

      <PreferencesSection tab="general" section="view">
        <Card>
          <CardHeader>
            <CardTitle>{t("view.title")}</CardTitle>
            <CardDescription>{t("view.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              name="defaultView"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>{t("view.label")}</FieldLabel>
                  <FieldDescription>{t("view.hint")}</FieldDescription>
                  <Select
                    items={viewOptions}
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                    }}
                  >
                    <SelectTrigger className="w-60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {viewOptions.map((option) => (
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
      </PreferencesSection>
    </div>
  )
}
