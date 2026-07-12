import { useHotkeys } from "@tanstack/react-hotkeys"

import {
  FilterableMenu,
  FilterableMenuItem,
} from "@/app/(v3)/v3/_/components/ui/filterable-menu"
import { Slider } from "@/app/(v3)/v3/_/components/ui/slider"
import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import { useUserPreferences } from "@/app/(v3)/v3/_/components/user-preferences-provider"
import { type BookFiltersController } from "@/app/(v3)/v3/_/hooks/use-book-filters"
import { useTranslation } from "@/app/(v3)/v3/_/hooks/use-translation"
import { cn } from "@/cn"
import { FieldIcon } from "@/icons"
import * as icon from "@/icons"
import { DISPLAY_FIELDS } from "@/sort"
import { useSetUserSettingMutation } from "@/store/api"

import { useColorPreferences } from "./BookDetails/sections/useCoverColors"

const displayHotKey = "Shift+D"

export function DisplayControl({
  displayOverrides,
  onDisplayOverridesChange,
  open,
  onOpenChange,
}: {
  displayOverrides: BookFiltersController["displayOverrides"]
  onDisplayOverridesChange: BookFiltersController["setDisplayOverrides"]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const tLabels = useTranslation("Common.fields.label")
  const t = useTranslation("BooksPage")

  const { gridCoverDisplay, gridCardSize } = useUserPreferences()
  const [updateSetting, { isLoading: isSaving }] = useSetUserSettingMutation()
  const { colorMix, intensity } = useColorPreferences()

  useHotkeys([
    {
      hotkey: displayHotKey,
      callback: () => {
        onOpenChange(!open)
      },
    },
  ])

  return (
    <FilterableMenu
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <TooltipButton
          variant="ghost"
          size="icon"
          aria-label={t.plain("displayOptions.tooltip")}
          className="shrink-0"
          tooltip={t("displayOptions.tooltip")}
          shortcut={[displayHotKey]}
        >
          <icon.Columns />
        </TooltipButton>
      }
      searchable
      searchPlaceholder={t.plain("displayOptions.searchHint")}
    >
      <span className="text-muted-foreground px-2 text-xs">Vibrancy</span>
      <FilterableMenuItem
        key="subdued"
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
        key="vibrant"
        closeOnClick={false}
        textValue="Vibrant"
        onSelect={() => {
          void updateSetting({ name: "colorMix", value: "vibrant" })
        }}
      >
        Vibrant
        {colorMix === "vibrant" && <icon.Check className="ml-auto" />}
      </FilterableMenuItem>
      <Slider
        defaultValue={intensity * 100}
        thumbAlignment="edge"
        onValueCommitted={(value) => {
          void updateSetting({
            name: "colorIntensity",
            value: (Array.isArray(value) ? value[0] : value) / 100,
          })
        }}
        className="w-full! flex-1 px-3"
        min={0}
        max={100}
        step={1}
      />
      <span className="text-muted-foreground px-2 text-xs">Card</span>
      <div className="-w-full flex items-center justify-center gap-2">
        <TooltipButton
          tooltip="Double cover"
          variant="ghost"
          aria-label="Use Double cover when available in the grid"
          className={cn(gridCoverDisplay === "auto" && "bg-muted")}
          onClick={() => {
            void updateSetting({ name: "gridCoverDisplay", value: "auto" })
          }}
        >
          <icon.Readaloud size="lg" />
        </TooltipButton>
        <TooltipButton
          tooltip="Ebook cover"
          variant="ghost"
          aria-label="Use Ebook cover in the grid"
          className={cn(gridCoverDisplay === "ebook" && "bg-muted")}
          onClick={() => {
            void updateSetting({ name: "gridCoverDisplay", value: "ebook" })
          }}
        >
          <icon.Book />
        </TooltipButton>
        <TooltipButton
          tooltip="Audiobook cover"
          variant="ghost"
          aria-label="Use Audiobook cover in the grid"
          className={cn(gridCoverDisplay === "audiobook" && "bg-muted")}
          onClick={() => {
            void updateSetting({ name: "gridCoverDisplay", value: "audiobook" })
          }}
        >
          <icon.Audiobook />
        </TooltipButton>
      </div>

      <span className="text-muted-foreground px-2 text-xs">Card size</span>
      <div className="-w-full flex items-center justify-center gap-2">
        <TooltipButton
          tooltip="Extra Small"
          variant="ghost"
          aria-label="Use Extra Small card size in the grid"
          className={cn(gridCardSize === "smallest" && "bg-muted")}
          onClick={() => {
            void updateSetting({ name: "gridCardSize", value: "smallest" })
          }}
        >
          XS
        </TooltipButton>
        <TooltipButton
          tooltip="Small"
          variant="ghost"
          aria-label="Use Small card size in the grid"
          className={cn(gridCardSize === "small" && "bg-muted")}
          onClick={() => {
            void updateSetting({ name: "gridCardSize", value: "small" })
          }}
        >
          S
        </TooltipButton>
        <TooltipButton
          tooltip="Ebook cover"
          variant="ghost"
          aria-label="Use Ebook cover in the grid"
          className={cn(gridCardSize === "medium" && "bg-muted")}
          onClick={() => {
            void updateSetting({ name: "gridCardSize", value: "medium" })
          }}
        >
          M
        </TooltipButton>
        <TooltipButton
          tooltip="Audiobook cover"
          variant="ghost"
          aria-label="Use Audiobook cover in the grid"
          className={cn(gridCardSize === "large" && "bg-muted")}
          onClick={() => {
            void updateSetting({ name: "gridCardSize", value: "large" })
          }}
        >
          L
        </TooltipButton>
        <TooltipButton
          tooltip="Extra Large"
          variant="ghost"
          aria-label="Use Extra Large card size in the grid"
          className={cn(gridCardSize === "largest" && "bg-muted")}
          onClick={() => {
            void updateSetting({ name: "gridCardSize", value: "largest" })
          }}
        >
          XL
        </TooltipButton>
      </div>
      {/* </div> */}

      <span className="text-muted-foreground px-2 text-xs">
        {t("displayOptions.hint")}
      </span>
      <FilterableMenuItem
        closeOnClick={false}
        textValue={t.plain("displayOptions.auto")}
        onSelect={() => {
          void onDisplayOverridesChange(null)
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
            void onDisplayOverridesChange([field])
          }}
        >
          <FieldIcon field={field} className="mr-2" />
          {tLabels(field)}
          {displayOverrides?.includes(field) && (
            <icon.Check className="ml-auto" />
          )}
        </FilterableMenuItem>
      ))}
    </FilterableMenu>
  )
}
