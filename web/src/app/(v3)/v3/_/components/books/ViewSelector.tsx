import { LayoutGrid, List, Table2 } from "lucide-react"
import { useDispatch, useSelector } from "react-redux"

import { ToggleGroup, ToggleGroupItem } from "@v3/_/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@v3/_/components/ui/tooltip"
// import {
//   type ViewType,
//   selectViewType,
//   viewSettingsSlice,
// } from "@/store/slices/viewSettingsSlice"

const viewOptions: { value: ViewType; label: string; icon: React.ReactNode }[] =
  [
    { value: "grid", label: "Grid", icon: <LayoutGrid className="h-4 w-4" /> },
    { value: "list", label: "List", icon: <List className="h-4 w-4" /> },
    { value: "table", label: "Table", icon: <Table2 className="h-4 w-4" /> },
  ]

export function ViewSelector() {
  const dispatch = useDispatch()
  const viewType = useSelector(selectViewType)

  const handleChange = (value: string) => {
    if (value) {
      dispatch(viewSettingsSlice.actions.setViewType(value as ViewType))
    }
  }

  return (
    <ToggleGroup
      type="single"
      value={viewType}
      onValueChange={handleChange}
      variant="outline"
      size="sm"
    >
      {viewOptions.map((option) => (
        <Tooltip key={option.value}>
          <TooltipTrigger asChild>
            <ToggleGroupItem value={option.value} aria-label={option.label}>
              {option.icon}
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent side="bottom">{option.label} view</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  )
}
