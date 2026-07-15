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
import { getFieldDef } from "@/fields"
import { FieldIcon } from "@/icons"
import * as icon from "@/icons"
import { DISPLAY_FIELDS, type DisplayField, insertDisplayField } from "@/sort"
import { useSetUserSettingMutation } from "@/store/api"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import {
  type GridSpacing,
  selectBookLayout,
  selectGridSpacing,
  selectGridView,
  selectListDisplayFields,
  selectListShowThumbnail,
  selectListView,
  selectShowProcessingBadge,
  selectShowReadaloudBadge,
  uiSettingsSlice,
} from "@/store/slices/uiSettingsSlice"

import { useColorPreferences } from "./BookDetails/sections/useCoverColors"

const displayHotKey = "Shift+D"

export function DisplayControl({
  displayOverrides,
  onDisplayOverridesChange,
  currentFields,
  open,
  onOpenChange,
  showLayout = true,
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
  showLayout?: boolean
}) {
  const tLabels = useTranslation("Common.fields.label")
  const t = useTranslation("BooksPage")

  const { gridCoverDisplay } = useUserPreferences()
  const [updateSetting] = useSetUserSettingMutation()
  const { strength } = useColorPreferences()

  const dispatch = useAppDispatch()
  const bookLayout = useAppSelector(selectBookLayout)
  const gridView = useAppSelector(selectGridView)
  const listView = useAppSelector(selectListView)
  const listDisplayFields = useAppSelector(selectListDisplayFields)
  const listShowThumbnail = useAppSelector(selectListShowThumbnail)
  const gridSpacing = useAppSelector(selectGridSpacing)
  const gridCardSize = useAppSelector((state) => state.uiSettings.gridCardSize)
  const showReadaloudBadge = useAppSelector(selectShowReadaloudBadge)
  const showProcessingBadge = useAppSelector(selectShowProcessingBadge)

  useHotkeys([
    {
      hotkey: displayHotKey,
      callback: () => {
        onOpenChange(!open)
      },
    },
  ])

  const isGrid = bookLayout === "grid"

  // the set the checkmarks reflect: the layout's own field selection. for the
  // grid that's the explicit selection or (in auto mode) whatever auto
  // currently resolves to; the list layout is always explicit.
  const shown = isGrid ? displayOverrides ?? currentFields : listDisplayFields

  // toggled-on fields always land above the title row, never below it. the
  // grid and list layouts keep independent selections.
  const toggleField = (field: DisplayField) => {
    const base = isGrid ? displayOverrides ?? currentFields : listDisplayFields
    const next = base.includes(field)
      ? base.filter((f) => f !== field)
      : insertDisplayField(base, field)
    if (isGrid) {
      onDisplayOverridesChange(next)
    } else {
      dispatch(uiSettingsSlice.actions.setListDisplayFields(next))
    }
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
        {/* ---- layout + per-layout view ---- */}
        {showLayout && (
          <>
            <FilterableMenuGroup>
              <FilterableMenuLabel>Layout</FilterableMenuLabel>

              <FilterableMenuItem
                closeOnClick={false}
                textValue="Grid"
                icon={<icon.LayoutGrid className="size-4" />}
                onSelect={() => {
                  dispatch(uiSettingsSlice.actions.setBookLayout("grid"))
                }}
              >
                Grid
                {isGrid && <icon.Check className="ml-auto" />}
              </FilterableMenuItem>

              <FilterableMenuItem
                closeOnClick={false}
                textValue="List"
                icon={<icon.LayoutList className="size-4" />}
                onSelect={() => {
                  dispatch(uiSettingsSlice.actions.setBookLayout("list"))
                }}
              >
                List
                {!isGrid && <icon.Check className="ml-auto" />}
              </FilterableMenuItem>
            </FilterableMenuGroup>

            <FilterableMenuGroup>
              <FilterableMenuLabel>View</FilterableMenuLabel>

              {isGrid ? (
                <>
                  <FilterableMenuItem
                    closeOnClick={false}
                    textValue="Cards"
                    icon={<icon.LayoutGrid className="size-4" />}
                    onSelect={() => {
                      dispatch(uiSettingsSlice.actions.setGridView("card"))
                    }}
                  >
                    Cards
                    {gridView === "card" && <icon.Check className="ml-auto" />}
                  </FilterableMenuItem>

                  <FilterableMenuItem
                    closeOnClick={false}
                    textValue="Covers only"
                    icon={<icon.Book className="size-4" />}
                    onSelect={() => {
                      dispatch(uiSettingsSlice.actions.setGridView("thumbnail"))
                    }}
                  >
                    Covers only
                    {gridView === "thumbnail" && (
                      <icon.Check className="ml-auto" />
                    )}
                  </FilterableMenuItem>
                </>
              ) : (
                <>
                  <FilterableMenuItem
                    closeOnClick={false}
                    textValue="Rows"
                    icon={<icon.LayoutList className="size-4" />}
                    onSelect={() => {
                      dispatch(uiSettingsSlice.actions.setListView("list"))
                    }}
                  >
                    Rows
                    {listView === "list" && <icon.Check className="ml-auto" />}
                  </FilterableMenuItem>

                  <FilterableMenuItem
                    closeOnClick={false}
                    textValue="Table"
                    icon={<icon.Columns3 className="size-4" />}
                    onSelect={() => {
                      dispatch(uiSettingsSlice.actions.setListView("table"))
                    }}
                  >
                    Table
                    {listView === "table" && <icon.Check className="ml-auto" />}
                  </FilterableMenuItem>

                  <FilterableMenuItem
                    closeOnClick={false}
                    textValue="Thumbnails"
                    icon={<icon.Book className="size-4" />}
                    onSelect={() => {
                      dispatch(
                        uiSettingsSlice.actions.setListShowThumbnail(
                          !listShowThumbnail,
                        ),
                      )
                    }}
                  >
                    Thumbnails
                    {listShowThumbnail && <icon.Check className="ml-auto" />}
                  </FilterableMenuItem>
                </>
              )}
            </FilterableMenuGroup>

            <FilterableMenuSeparator />
          </>
        )}

        {/* ---- appearance ---- */}
        <FilterableMenuGroup>
          <FilterableMenuLabel>Appearance</FilterableMenuLabel>

          <FilterableMenuSub>
            <FilterableMenuSubTrigger textValue="Color intensity">
              Intensity
            </FilterableMenuSubTrigger>
            <FilterableMenuSubContent>
              <IntensitySubmenu strength={strength} />
            </FilterableMenuSubContent>
          </FilterableMenuSub>
        </FilterableMenuGroup>

        <FilterableMenuSeparator />

        {/* ---- card (grid layout only) + badges ---- */}
        <FilterableMenuGroup>
          <FilterableMenuLabel>{isGrid ? "Card" : "Row"}</FilterableMenuLabel>

          {isGrid && (
            <>
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
                      dispatch(
                        uiSettingsSlice.actions.setGridCardSize(
                          v as typeof gridCardSize,
                        ),
                      )
                    }}
                  />
                </FilterableMenuSubContent>
              </FilterableMenuSub>

              <FilterableMenuSub>
                <FilterableMenuSubTrigger
                  icon={<icon.ArrowsMaximize className="size-4" />}
                  textValue="Card spacing"
                >
                  Card spacing
                </FilterableMenuSubTrigger>
                <FilterableMenuSubContent>
                  <SpacingSubmenu
                    value={gridSpacing}
                    onChange={(v) => {
                      dispatch(uiSettingsSlice.actions.setGridSpacing(v))
                    }}
                  />
                </FilterableMenuSubContent>
              </FilterableMenuSub>
            </>
          )}

          <FilterableMenuItem
            closeOnClick={false}
            textValue="Readaloud icon"
            icon={<icon.Readaloud className="size-4" />}
            onSelect={() => {
              dispatch(
                uiSettingsSlice.actions.setShowReadaloudBadge(
                  !showReadaloudBadge,
                ),
              )
            }}
          >
            Readaloud icon
            {showReadaloudBadge && <icon.Check className="ml-auto" />}
          </FilterableMenuItem>

          <FilterableMenuItem
            closeOnClick={false}
            textValue="Processing icon"
            icon={<icon.Loader className="size-4" />}
            onSelect={() => {
              dispatch(
                uiSettingsSlice.actions.setShowProcessingBadge(
                  !showProcessingBadge,
                ),
              )
            }}
          >
            Processing icon
            {showProcessingBadge && <icon.Check className="ml-auto" />}
          </FilterableMenuItem>
        </FilterableMenuGroup>

        <FilterableMenuSeparator />

        {/* ---- show on card ---- */}
        <FilterableMenuGroup>
          <FilterableMenuLabel>
            {t.plain("displayOptions.hint")}
          </FilterableMenuLabel>

          {isGrid && (
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
          )}

          {DISPLAY_FIELDS.filter(
            (field) => getFieldDef(field).group !== "alignment",
          ).map((field) => (
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

          <FilterableMenuSub>
            <FilterableMenuSubTrigger
              icon={<icon.AlignLeft className="size-4" />}
              textValue={tLabels.plain("alignment")}
            >
              {tLabels("alignment")}
            </FilterableMenuSubTrigger>
            <FilterableMenuSubContent searchable>
              {DISPLAY_FIELDS.filter(
                (field) => getFieldDef(field).group === "alignment",
              ).map((field) => (
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
            </FilterableMenuSubContent>
          </FilterableMenuSub>
        </FilterableMenuGroup>
      </FilterableMenuContent>
    </FilterableMenu>
  )
}

// ---- sub-menus -------------------------------------------------------------

function IntensitySubmenu({ strength }: { strength: number }) {
  const [updateSetting] = useSetUserSettingMutation()
  // 65 is the neutral default (the historical full-strength look); 100 pushes
  // well past it
  const steps = [0, 25, 50, 65, 85, 100]
  const current = Math.round(strength * 100)

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

function SpacingSubmenu({
  value,
  onChange,
}: {
  value: GridSpacing
  onChange: (v: GridSpacing) => void
}) {
  const options: { id: GridSpacing; label: string }[] = [
    { id: "compact", label: "Compact" },
    { id: "cozy", label: "Cozy" },
    { id: "spacious", label: "Spacious" },
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
