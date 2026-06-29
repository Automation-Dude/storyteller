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
import { useTranslation } from "@v3/_/hooks/use-translation"

import { MultidimensionalRating } from "@/app/(v3)/v3/_/components/books/BookDetails/sections/MultidimensionalRating"
import { RatingInput } from "@/app/(v3)/v3/_/components/books/RatingInput"
import { statusDisplayLabel } from "@/database/statusKinds"
import {
  BookDetailDisplays,
  DoubleCoverAlignments,
  GridCardSizes,
  GridCoverDisplays,
  RatingIcons,
} from "@/database/userPreferencesTypes"
import { useListStatusesQuery } from "@/store/api"

import { DetailDisplayPreview, GridCoverPreview } from "./cover-style-preview"
import {
  type PreferencesFormType,
  PreferencesSection,
  SegmentedControl,
} from "./shared"

const VIEW_KEYS = ["cover", "spine", "pages", "back"] as const
const USE_LIBRARY_DEFAULT = "__library_default__"

export function BooksTab({ form }: { form: PreferencesFormType }) {
  const t = useTranslation("PreferencesPage.tabs.books.sections")

  const gridCoverOptions = GridCoverDisplays.map((key) => ({
    value: key,
    label: t(`gridDisplay.coverOptions.${key}`),
  }))

  const alignmentOptions = DoubleCoverAlignments.map((key) => ({
    value: key,
    label: t(`gridDisplay.alignmentOptions.${key}`),
  }))

  const gridSizeOptions = GridCardSizes.map((key) => ({
    value: key,
    label: t(`gridDisplay.sizeOptions.${key}`),
  }))

  const detailDisplayOptions = BookDetailDisplays.map((key) => ({
    value: key,
    label: t(`detail.display.options.${key}`),
  }))

  const ratingIconOptions = RatingIcons.map((key) => ({
    value: key,
    label: t(`ratingIcon.options.${key}`),
  }))

  const gridCoverDisplay = useWatch({
    control: form.control,
    name: "gridCoverDisplay",
  })

  const doubleCoverAlignment = useWatch({
    control: form.control,
    name: "doubleCoverAlignment",
  })

  const bookDetailDisplay = useWatch({
    control: form.control,
    name: "bookDetailDisplay",
  })

  const {
    fields: dimensions,
    append: appendDimension,
    remove: removeDimension,
  } = useFieldArray({
    control: form.control,
    name: "ratingDimensions",
    keyName: "_key",
  })

  const primaryColor = useWatch({
    control: form.control,
    name: "accentColor",
  })

  return (
    <div className="space-y-6">
      <PreferencesSection tab="books" section="gridDisplay">
        <Card>
          <CardHeader>
            <CardTitle>{t("gridDisplay.title")}</CardTitle>
            <CardDescription>{t("gridDisplay.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-6">
              <div className="flex-1 space-y-6">
                <Controller
                  name="gridCoverDisplay"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel>{t("gridDisplay.coverLabel")}</FieldLabel>
                      <FieldDescription>
                        {t("gridDisplay.coverHint")}
                      </FieldDescription>
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

                {gridCoverDisplay === "auto" && (
                  <Controller
                    name="doubleCoverAlignment"
                    control={form.control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel>
                          {t("gridDisplay.alignmentLabel")}
                        </FieldLabel>
                        <FieldDescription>
                          {t("gridDisplay.alignmentHint")}
                        </FieldDescription>
                        <SegmentedControl
                          value={field.value}
                          onChange={(value) => {
                            field.onChange(value)
                          }}
                          options={alignmentOptions}
                        />
                      </Field>
                    )}
                  />
                )}
              </div>

              <GridCoverPreview
                display={gridCoverDisplay}
                alignment={doubleCoverAlignment}
              />
            </div>

            <Controller
              name="gridCardSize"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>{t("gridDisplay.sizeLabel")}</FieldLabel>
                  <FieldDescription>
                    {t("gridDisplay.sizeHint")}
                  </FieldDescription>
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
            <div className="flex gap-6">
              <div className="flex-1 space-y-6">
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
                        <FieldDescription>
                          {t("detail.view.hint")}
                        </FieldDescription>
                        <Select
                          value={
                            field.value === null ? "0" : String(field.value)
                          }
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
              </div>

              <DetailDisplayPreview display={bookDetailDisplay} />
            </div>
          </CardContent>
        </Card>
      </PreferencesSection>

      <PreferencesSection tab="books" section="ratings">
        <Card>
          <CardHeader>
            <CardTitle>{t("ratings.title")}</CardTitle>
            <CardDescription>{t("ratings.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Controller
              name="ratingIcon"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>{t("ratingIcon.label")}</FieldLabel>
                  <FieldDescription>{t("ratingIcon.hint")}</FieldDescription>
                  <SegmentedControl
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value)
                    }}
                    options={ratingIconOptions}
                  />
                  <div className="mt-4 flex flex-col gap-2">
                    <span className="text-muted-foreground text-xs font-medium">
                      Example
                    </span>
                    <RatingInput
                      value={3.5}
                      color={primaryColor ?? undefined}
                      iconOverride={field.value}
                      onChange={() => {}}
                    />
                  </div>
                </Field>
              )}
            />

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

              <div className="mt-4">
                <span className="text-muted-foreground text-xs font-medium">
                  Preview
                </span>
                <MultidimensionalRating
                  dimensions={dimensions}
                  scores={Object.fromEntries(
                    dimensions.map((d, i) => [d.id, 3.5 - (i % 2)]),
                  )}
                  onChange={() => {}}
                  onRemove={() => {}}
                  color={primaryColor ?? undefined}
                />
              </div>
            </Field>
          </CardContent>
        </Card>
      </PreferencesSection>

      <PreferencesSection tab="books" section="defaultStatus">
        <Card>
          <CardHeader>
            <CardTitle>{t("defaultStatus.title")}</CardTitle>
            <CardDescription>{t("defaultStatus.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <DefaultStatusField form={form} />
          </CardContent>
        </Card>
      </PreferencesSection>
    </div>
  )
}

function DefaultStatusField({ form }: { form: PreferencesFormType }) {
  const t = useTranslation("PreferencesPage.tabs.books.sections.defaultStatus")

  const { data: statuses = [] } = useListStatusesQuery()

  const items = statuses.map((status) => ({
    value: status.uuid,
    label: statusDisplayLabel(status),
  }))

  return (
    <Controller
      name="defaultStatusUuid"
      control={form.control}
      render={({ field }) => (
        <Field>
          <FieldLabel>{t("label")}</FieldLabel>
          <FieldDescription>{t("hint")}</FieldDescription>

          <Select
            value={field.value ?? USE_LIBRARY_DEFAULT}
            onValueChange={(v) => {
              field.onChange(v === USE_LIBRARY_DEFAULT ? null : v)
            }}
            items={[
              ...items,
              { value: USE_LIBRARY_DEFAULT, label: t("useLibraryDefault") },
            ]}
          >
            <SelectTrigger className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={USE_LIBRARY_DEFAULT}>
                {t("useLibraryDefault")}
              </SelectItem>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    />
  )
}
