import { IconLayoutGrid, IconLayoutList } from "@tabler/icons-react"

import { ButtonGroup } from "@v3/_/components/ui/button-group"
import { Button } from "@v3/_/components/ui/button"

import { type BookView } from "@/store/slices/uiSettingsSlice"
import { TooltipButton } from "../ui/tooltip-button"

type ViewSelectorProps = {
  value: BookView
  onChange: (value: BookView) => void
}

export function ViewSelector({ value, onChange }: ViewSelectorProps) {
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
        tooltip="Grid view"
        disabled={value === "grid"}
      >
        <IconLayoutGrid className="h-3.5 w-3.5" />
      </TooltipButton>

      <TooltipButton
        variant={value === "list" ? "secondary" : "outline"}
        size="default"
        onClick={() => {
          onChange("list")
        }}
        aria-label="List view"
        className="px-2"
        tooltip="List view"
        disabled={value === "list"}
      >
        <IconLayoutList className="h-3.5 w-3.5" />
      </TooltipButton>
    </ButtonGroup>
  )
}
