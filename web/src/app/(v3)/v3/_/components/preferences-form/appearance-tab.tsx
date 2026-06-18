"use client"

import { Controller, useWatch } from "react-hook-form"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@v3/_/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@v3/_/components/ui/field"
import { Slider } from "@v3/_/components/ui/slider"

import { useTranslation } from "@v3/_/hooks/use-translation"

import { ColorModes } from "@/database/userPreferencesTypes"

import { AccentColorPicker } from "./accent-color-picker"
import { ColorfulnessPreview } from "./colorfulness-preview"
import {
  type PreferencesFormType,
  PreferencesSection,
  SegmentedControl,
} from "./shared"

export function AppearanceTab({ form }: { form: PreferencesFormType }) {
  const t = useTranslation("PreferencesPage.tabs.appearance.sections")

  const colorModeOptions = ColorModes.map((key) => ({
    value: key,
    label: t(`colorfulness.levels.${key}`),
  }))

  const colorMode = useWatch({ control: form.control, name: "colorMode" })
  const colorIntensity = useWatch({
    control: form.control,
    name: "colorIntensity",
  })

  return (
    <div className="space-y-6">
      <PreferencesSection tab="appearance" section="accent">
        <Card>
          <CardHeader>
            <CardTitle>{t("accent.title")}</CardTitle>
            <CardDescription>{t("accent.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              name="accentColor"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>{t("accent.label")}</FieldLabel>
                  <FieldDescription>{t("accent.hint")}</FieldDescription>
                  <AccentColorPicker
                    value={field.value ?? null}
                    onChange={(value) => {
                      field.onChange(value)
                    }}
                    defaultLabel={t("accent.useDefault")}
                    customLabel={t("accent.custom")}
                  />
                </Field>
              )}
            />
          </CardContent>
        </Card>
      </PreferencesSection>

      <PreferencesSection tab="appearance" section="colorfulness">
        <Card>
          <CardHeader>
            <CardTitle>{t("colorfulness.title")}</CardTitle>
            <CardDescription>{t("colorfulness.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Controller
              name="colorMode"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>{t("colorfulness.label")}</FieldLabel>
                  <FieldDescription>{t("colorfulness.hint")}</FieldDescription>
                  <SegmentedControl
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value)
                    }}
                    options={colorModeOptions}
                  />
                </Field>
              )}
            />

            <Controller
              name="colorIntensity"
              control={form.control}
              render={({ field }) => (
                <Field data-disabled={colorMode === "minimal"}>
                  <FieldLabel>{t("colorfulness.intensity.label")}</FieldLabel>
                  <FieldDescription>
                    {t("colorfulness.intensity.hint")}
                  </FieldDescription>
                  <Slider
                    className="max-w-xs"
                    min={0}
                    max={1}
                    step={0.05}
                    disabled={colorMode === "minimal"}
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(Array.isArray(value) ? value[0] : value)
                    }}
                  />
                </Field>
              )}
            />

            <ColorfulnessPreview level={colorMode} intensity={colorIntensity} />
          </CardContent>
        </Card>
      </PreferencesSection>
    </div>
  )
}
