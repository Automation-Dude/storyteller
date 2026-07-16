import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@v3/_/components/ui/dropdown-menu"
import { useUserPreferences } from "@v3/_/components/user-preferences-provider"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { FieldIcon } from "@/icons"
import * as icon from "@/icons"
import { DISPLAY_FIELDS, type DisplayField } from "@/sort"
import { useSetUserSettingMutation } from "@/store/api"
import { type BookView } from "@/store/slices/uiSettingsSlice"

export function DisplayOverflowContent({
  displayOverrides,
  onDisplayOverridesChange,
  bookView,
  onBookViewChange,
}: {
  displayOverrides: DisplayField[] | null
  onDisplayOverridesChange: (fields: DisplayField[] | null) => void
  bookView?: BookView
  onBookViewChange?: (view: BookView) => void
}) {
  const tLabel = useTranslation("Common.fields.label")
  const { gridCoverDisplay, gridCardSize } = useUserPreferences()
  const [updateSetting] = useSetUserSettingMutation()

  return (
    <>
      {bookView && onBookViewChange && (
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-xs">
            Layout
          </DropdownMenuLabel>

          <DropdownMenuCheckboxItem
            checked={bookView === "grid"}
            onClick={() => {
              onBookViewChange("grid")
            }}
          >
            <icon.LayoutGrid className="mr-2 h-4 w-4" />
            Grid
          </DropdownMenuCheckboxItem>

          <DropdownMenuCheckboxItem
            checked={bookView === "list"}
            onClick={() => {
              onBookViewChange("list")
            }}
          >
            <icon.LayoutList className="mr-2 h-4 w-4" />
            List
          </DropdownMenuCheckboxItem>

          <DropdownMenuSeparator />
        </DropdownMenuGroup>
      )}

      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Cover
        </DropdownMenuLabel>

        <DropdownMenuCheckboxItem
          checked={gridCoverDisplay === "auto"}
          onClick={() => {
            void updateSetting({ name: "gridCoverDisplay", value: "auto" })
          }}
        >
          Double cover
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={gridCoverDisplay === "ebook"}
          onClick={() => {
            void updateSetting({ name: "gridCoverDisplay", value: "ebook" })
          }}
        >
          Ebook cover
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={gridCoverDisplay === "audiobook"}
          onClick={() => {
            void updateSetting({ name: "gridCoverDisplay", value: "audiobook" })
          }}
        >
          Audiobook cover
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
      </DropdownMenuGroup>

      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Card size
        </DropdownMenuLabel>

        {(["smallest", "small", "medium", "large", "largest"] as const).map(
          (size) => (
            <DropdownMenuCheckboxItem
              key={size}
              checked={gridCardSize === size}
              onClick={() => {
                void updateSetting({ name: "gridCardSize", value: size })
              }}
            >
              {size.charAt(0).toUpperCase() + size.slice(1)}
            </DropdownMenuCheckboxItem>
          ),
        )}

        <DropdownMenuSeparator />
      </DropdownMenuGroup>

      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Show on card
        </DropdownMenuLabel>

        <DropdownMenuCheckboxItem
          checked={!displayOverrides}
          onClick={() => {
            onDisplayOverridesChange(null)
          }}
        >
          Auto
        </DropdownMenuCheckboxItem>

        {DISPLAY_FIELDS.map((field) => (
          <DropdownMenuCheckboxItem
            key={field}
            checked={displayOverrides?.includes(field) ?? false}
            onClick={() => {
              onDisplayOverridesChange([field])
            }}
          >
            <FieldIcon field={field} className="mr-2 h-4 w-4" />
            {tLabel(field)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuGroup>
    </>
  )
}
