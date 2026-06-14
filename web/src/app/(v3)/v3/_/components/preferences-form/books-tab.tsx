"use client"

import { IconPlus, IconTrash } from "@tabler/icons-react"
import { Controller, useFieldArray, useWatch } from "react-hook-form"
import { v4 as uuidv4 } from "uuid"

import { Button } from "@v3/_/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@v3/_/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@v3/_/components/ui/field"
import { Input } from "@v3/_/components/ui/input"
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

  // keyName "_key" so react-hook-form's react key doesn't clobber our stable
  // dimension id (which links recorded per-book scores)
  const {
    fields: dimensions,
    append: appendDimension,
    remove: removeDimension,
  } = useFieldArray({
    control: form.control,
    name: "ratingDimensions",
    keyName: "_key",
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
                  <FieldDescription>
                    {t("detail.display.hint")}
                  </FieldDescription>
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

      <PreferencesSection tab="books" section="ratingDimensions">
        <Card>
          <CardHeader>
            <CardTitle>{t("ratingDimensions.title")}</CardTitle>
            <CardDescription>
              {t("ratingDimensions.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Field>
              <FieldLabel>{t("ratingDimensions.label")}</FieldLabel>
              <FieldDescription>{t("ratingDimensions.hint")}</FieldDescription>
              <div className="flex flex-col gap-2">
                {dimensions.map((dimension, index) => (
                  <div key={dimension._key} className="flex items-center gap-2">
                    <Controller
                      name={`ratingDimensions.${index}.label`}
                      control={form.control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          placeholder={t("ratingDimensions.placeholder")}
                          className="flex-1"
                        />
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("ratingDimensions.remove")}
                      onClick={() => {
                        removeDimension(index)
                      }}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    appendDimension({ id: uuidv4(), label: "" })
                  }}
                >
                  <IconPlus className="mr-1 h-4 w-4" />
                  {t("ratingDimensions.add")}
                </Button>
              </div>
            </Field>
          </CardContent>
        </Card>
      </PreferencesSection>
    </TabsContent>
  )
}
