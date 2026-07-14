import { useHotkeys } from "@tanstack/react-hotkeys"

import {
  FilterableMenu,
  FilterableMenuContent,
  FilterableMenuGroup,
  FilterableMenuItem,
  FilterableMenuLabel,
  FilterableMenuSeparator,
  FilterableMenuSub,
  FilterableMenuSubContent,
  FilterableMenuSubTrigger,
  FilterableMenuTrigger,
} from "@/app/(v3)/v3/_/components/ui/filterable-menu"
import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import { useUserPreferences } from "@/app/(v3)/v3/_/components/user-preferences-provider"
import { useTranslation } from "@/app/(v3)/v3/_/hooks/use-translation"
import { FieldIcon } from "@/icons"
import * as icon from "@/icons"
import { DISPLAY_FIELDS, type DisplayField } from "@/sort"
import { useSetUserSettingMutation } from "@/store/api"
import { type BookView } from "@/store/slices/uiSettingsSlice"

import { useColorPreferences } from "./BookDetails/sections/useCoverColors"

const displayHotKey = "Shift+D"

export function DisplayControl({
  displayOverrides,
  onDisplayOverridesChange,
  currentFields,
  open,
  onOpenChange,
  bookView,
  onBookViewChange,
}: {
  // null = auto (derived from sort/filter); an explicit array is the user's own
  // choice (an empty array shows nothing under the cover).
  displayOverrides: DisplayField[] | null
  onDisplayOverridesChange: (fields: DisplayField[] | null) => void
  // the fields actually being shown right now (the resolved auto/manual set), so
  // toggling out of auto starts from what the user already sees.
  currentFields: DisplayField[]
  open: boolean
  onOpenChange: (open: boolean) => void
  bookView?: BookView
  onBookViewChange?: (view: BookView) => void
}) {
  const tLabels = useTranslation("Common.fields.label")
  const t = useTranslation("BooksPage")

  const { gridCoverDisplay, gridCardSize } = useUserPreferences()
  const [updateSetting] = useSetUserSettingMutation()
  const { colorMix, intensity } = useColorPreferences()

  useHotkeys([
    {
      hotkey: displayHotKey,
      callback: () => {
        onOpenChange(!open)
      },
    },
  ])

  // the set the checkmarks reflect: the explicit selection, or (in auto mode)
  // whatever auto currently resolves to.
  const shown = displayOverrides ?? currentFields

  const toggleField = (field: DisplayField) => {
    const base = displayOverrides ?? currentFields
    onDisplayOverridesChange(
      base.includes(field) ? base.filter((f) => f !== field) : [...base, field],
    )
  }

  return (
    <FilterableMenu open={open} onOpenChange={onOpenChange}>
      <FilterableMenuTrigger
        render={
          <TooltipButton
            variant="ghost"
            size="icon-sm"
            aria-label={t.plain("displayOptions.tooltip")}
            className="shrink-0"
            tooltip={t("displayOptions.tooltip")}
            shortcut={[displayHotKey]}
          >
            <icon.Columns />
          </TooltipButton>
        }
      />
      <FilterableMenuContent
        searchPlaceholder={t.plain("displayOptions.searchHint")}
      >
        {/* ---- layout ---- */}
        {bookView && onBookViewChange && (
          <>
            <FilterableMenuGroup>
              <FilterableMenuLabel>Layout</FilterableMenuLabel>

              <FilterableMenuItem
                closeOnClick={false}
                textValue="Grid"
                icon={<icon.LayoutGrid className="size-4" />}
                onSelect={() => {
                  onBookViewChange("grid")
                }}
              >
                Grid
                {bookView === "grid" && <icon.Check className="ml-auto" />}
              </FilterableMenuItem>

              <FilterableMenuItem
                closeOnClick={false}
                textValue="List"
                icon={<icon.LayoutList className="size-4" />}
                onSelect={() => {
                  onBookViewChange("list")
                }}
              >
                List
                {bookView === "list" && <icon.Check className="ml-auto" />}
              </FilterableMenuItem>
            </FilterableMenuGroup>

            <FilterableMenuSeparator />
          </>
        )}

        {/* ---- appearance ---- */}
        <FilterableMenuGroup>
          <FilterableMenuLabel>Appearance</FilterableMenuLabel>

          <FilterableMenuItem
            closeOnClick={false}
            textValue="Subdued"
            onSelect={() => {
              void updateSetting({ name: "colorMix", value: "subdued" })
            }}
          >
            Subdued
            {colorMix === "subdued" && <icon.Check className="ml-auto" />}
          </FilterableMenuItem>

          <FilterableMenuItem
            closeOnClick={false}
            textValue="Vibrant"
            onSelect={() => {
              void updateSetting({ name: "colorMix", value: "vibrant" })
            }}
          >
            Vibrant
            {colorMix === "vibrant" && <icon.Check className="ml-auto" />}
          </FilterableMenuItem>

          <FilterableMenuSub>
            <FilterableMenuSubTrigger textValue="Color intensity">
              Intensity
            </FilterableMenuSubTrigger>
            <FilterableMenuSubContent>
              <IntensitySubmenu intensity={intensity} />
            </FilterableMenuSubContent>
          </FilterableMenuSub>
        </FilterableMenuGroup>

        <FilterableMenuSeparator />

        {/* ---- card ---- */}
        <FilterableMenuGroup>
          <FilterableMenuLabel>Card</FilterableMenuLabel>

          <FilterableMenuSub>
            <FilterableMenuSubTrigger
              icon={<icon.Readaloud className="size-4" />}
              textValue="Cover type"
            >
              Cover type
            </FilterableMenuSubTrigger>
            <FilterableMenuSubContent>
              <CoverTypeSubmenu
                value={gridCoverDisplay}
                onChange={(v) => {
                  void updateSetting({
                    name: "gridCoverDisplay",
                    value: v as typeof gridCoverDisplay,
                  })
                }}
              />
            </FilterableMenuSubContent>
          </FilterableMenuSub>

          <FilterableMenuSub>
            <FilterableMenuSubTrigger
              icon={<icon.Maximize className="size-4" />}
              textValue="Card size"
            >
              Card size
            </FilterableMenuSubTrigger>
            <FilterableMenuSubContent>
              <CardSizeSubmenu
                value={gridCardSize}
                onChange={(v) => {
                  void updateSetting({
                    name: "gridCardSize",
                    value: v as typeof gridCardSize,
                  })
                }}
              />
            </FilterableMenuSubContent>
          </FilterableMenuSub>
        </FilterableMenuGroup>

        <FilterableMenuSeparator />

        {/* ---- show on card ---- */}
        <FilterableMenuGroup>
          <FilterableMenuLabel>
            {t.plain("displayOptions.hint")}
          </FilterableMenuLabel>

          <FilterableMenuItem
            closeOnClick={false}
            textValue={t.plain("displayOptions.auto")}
            onSelect={() => {
              onDisplayOverridesChange(null)
            }}
          >
            {t("displayOptions.auto")}
            {displayOverrides === null && <icon.Check className="ml-auto" />}
          </FilterableMenuItem>

          {DISPLAY_FIELDS.map((field) => (
            <FilterableMenuItem
              key={field}
              closeOnClick={false}
              textValue={tLabels(field)}
              onSelect={() => {
                toggleField(field)
              }}
            >
              <FieldIcon field={field} className="mr-2" />
              {tLabels(field)}
              {shown.includes(field) && <icon.Check className="ml-auto" />}
            </FilterableMenuItem>
          ))}
        </FilterableMenuGroup>
      </FilterableMenuContent>
    </FilterableMenu>
  )
}

// ---- sub-menus -------------------------------------------------------------

function IntensitySubmenu({ intensity }: { intensity: number }) {
  const [updateSetting] = useSetUserSettingMutation()
  const steps = [0, 25, 50, 75, 100]
  const current = Math.round(intensity * 100)

  return (
    <>
      {steps.map((pct) => (
        <FilterableMenuItem
          key={pct}
          closeOnClick={false}
          textValue={`${pct}%`}
          onSelect={() => {
            void updateSetting({
              name: "colorIntensity",
              value: pct / 100,
            })
          }}
        >
          {pct}%{current === pct && <icon.Check className="ml-auto" />}
        </FilterableMenuItem>
      ))}
    </>
  )
}

function CoverTypeSubmenu({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const options = [
    {
      id: "auto",
      label: "Double cover",
      icon: <icon.Readaloud className="size-4" />,
    },
    {
      id: "ebook",
      label: "Ebook cover",
      icon: <icon.Book className="size-4" />,
    },
    {
      id: "audiobook",
      label: "Audiobook cover",
      icon: <icon.Audiobook className="size-4" />,
    },
  ]

  return (
    <>
      {options.map((opt) => (
        <FilterableMenuItem
          key={opt.id}
          closeOnClick={false}
          textValue={opt.label}
          icon={opt.icon}
          onSelect={() => {
            onChange(opt.id)
          }}
        >
          {opt.label}
          {value === opt.id && <icon.Check className="ml-auto" />}
        </FilterableMenuItem>
      ))}
    </>
  )
}

function CardSizeSubmenu({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const options = [
    { id: "smallest", label: "Extra Small" },
    { id: "small", label: "Small" },
    { id: "medium", label: "Medium" },
    { id: "large", label: "Large" },
    { id: "largest", label: "Extra Large" },
  ]

  return (
    <>
      {options.map((opt) => (
        <FilterableMenuItem
          key={opt.id}
          closeOnClick={false}
          textValue={opt.label}
          onSelect={() => {
            onChange(opt.id)
          }}
        >
          {opt.label}
          {value === opt.id && <icon.Check className="ml-auto" />}
        </FilterableMenuItem>
      ))}
    </>
  )
}
