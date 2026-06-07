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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v3/_/components/ui/select"
import { TabsContent } from "@v3/_/components/ui/tabs"
import { useTranslation } from "@v3/_/hooks/use-translation"

import {
  BookDetailDisplays,
  GridCardSizes,
  GridCoverDisplays,
} from "@/database/userPreferencesTypes"

import { CoverStylePreview } from "./cover-style-preview"
import {
  type PreferencesFormType,
  PreferencesSection,
  SegmentedControl,
} from "./shared"

// matches the preset angles in Book3D's VIEWS array
const VIEW_KEYS = ["cover", "spine", "pages", "back"] as const

export function BooksTab({ form }: { form: PreferencesFormType }) {
  const t = useTranslation("PreferencesPage.tabs.books.sections")

  const gridCoverOptions = GridCoverDisplays.map((key) => ({
    value: key,
    label: t(`gridCover.options.${key}`),
  }))

  const gridSizeOptions = GridCardSizes.map((key) => ({
    value: key,
    label: t(`gridSize.options.${key}`),
  }))

  const detailDisplayOptions = BookDetailDisplays.map((key) => ({
    value: key,
    label: t(`detail.display.options.${key}`),
  }))

  const gridCoverDisplay = useWatch({
    control: form.control,
    name: "gridCoverDisplay",
  })
  const bookDetailDisplay = useWatch({
    control: form.control,
    name: "bookDetailDisplay",
  })

  return (
    <TabsContent value="books" className="space-y-6">
      <PreferencesSection tab="books" section="gridCover">
        <Card>
          <CardHeader>
            <CardTitle>{t("gridCover.title")}</CardTitle>
            <CardDescription>{t("gridCover.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Controller
              name="gridCoverDisplay"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>{t("gridCover.label")}</FieldLabel>
                  <FieldDescription>{t("gridCover.hint")}</FieldDescription>
                  <SegmentedControl
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value)
                    }}
                    options={gridCoverOptions}
                  />
                </Field>
              )}
            />

            <CoverStylePreview display={gridCoverDisplay} />
          </CardContent>
        </Card>
      </PreferencesSection>

      <PreferencesSection tab="books" section="gridSize">
        <Card>
          <CardHeader>
            <CardTitle>{t("gridSize.title")}</CardTitle>
            <CardDescription>{t("gridSize.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              name="gridCardSize"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>{t("gridSize.label")}</FieldLabel>
                  <FieldDescription>{t("gridSize.hint")}</FieldDescription>
                  <SegmentedControl
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value)
                    }}
                    options={gridSizeOptions}
                  />
                </Field>
              )}
            />
          </CardContent>
        </Card>
      </PreferencesSection>

      <PreferencesSection tab="books" section="detail">
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.title")}</CardTitle>
            <CardDescription>{t("detail.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Controller
              name="bookDetailDisplay"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>{t("detail.display.label")}</FieldLabel>
                  <FieldDescription>{t("detail.display.hint")}</FieldDescription>
                  <SegmentedControl
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value)
                    }}
                    options={detailDisplayOptions}
                  />
                </Field>
              )}
            />

            {bookDetailDisplay === "3d" && (
              <Controller
                name="bookDetail3dView"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel>{t("detail.view.label")}</FieldLabel>
                    <FieldDescription>{t("detail.view.hint")}</FieldDescription>
                    <Select
                      value={field.value === null ? "0" : String(field.value)}
                      onValueChange={(value) => {
                        field.onChange(Number(value))
                      }}
                    >
                      <SelectTrigger className="w-60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIEW_KEYS.map((key, index) => (
                          <SelectItem key={key} value={String(index)}>
                            {t(`detail.view.options.${key}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            )}
          </CardContent>
        </Card>
      </PreferencesSection>
    </TabsContent>
  )
}
