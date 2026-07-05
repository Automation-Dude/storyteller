import * as icon from "@/icons"

import { ButtonGroup } from "@v3/_/components/ui/button-group"

import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import { type BookView } from "@/store/slices/uiSettingsSlice"
import { formatForDisplay, useHotkey } from "@tanstack/react-hotkeys"
import { Kbd, KbdGroup } from "../ui/kbd"

type ViewSelectorProps = {
  value: BookView
  onChange: (value: BookView) => void
}

export function ViewSelector({ value, onChange }: ViewSelectorProps) {
  useHotkey("Shift+G", () => {
    if (value === "grid") return
    onChange("grid")
  })
  useHotkey("Shift+L", () => {
    if (value === "list") return
    onChange("list")
  })

  return (
    <ButtonGroup className="shrink-0">
      <TooltipButton
        variant={value === "grid" ? "secondary" : "outline"}
        size="default"
        onClick={() => {
          onChange("grid")
        }}
        aria-label="Grid view"
        className="px-2"
        tooltip={"Grid view"}
        shortcut={["Shift+G"]}
        disabled={value === "grid"}
      >
        <icon.LayoutGrid className="h-3.5 w-3.5" />
      </TooltipButton>

      <TooltipButton
        variant={value === "list" ? "secondary" : "outline"}
        size="default"
        onClick={() => {
          onChange("list")
        }}
        aria-label="List view"
        className="px-2"
        tooltip={"List view"}
        shortcut={["Shift+L"]}
        disabled={value === "list"}
      >
        <icon.LayoutList className="h-3.5 w-3.5" />
      </TooltipButton>
    </ButtonGroup>
  )
}
