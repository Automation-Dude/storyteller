import { IconDotsVertical } from "@tabler/icons-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@v3/_/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"

export type HeaderAction = {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost"
}

type HeaderActionsProps = {
  actions: HeaderAction[]
}

export function HeaderActions({ actions }: HeaderActionsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(actions.length)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measureRef = document.createElement("div")
    measureRef.style.cssText =
      "position: absolute; visibility: hidden; display: flex; gap: 8px; white-space: nowrap;"
    container.appendChild(measureRef)

    const updateVisibleCount = () => {
      const containerWidth = container.offsetWidth
      // reserve space for the overflow menu button (40px) + gap
      const reservedWidth = 48

      let totalWidth = 0
      let count = 0

      for (let i = 0; i < actions.length; i++) {
        const action = actions[i]!
        const btn = document.createElement("button")
        btn.className =
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-8 px-3"
        btn.innerHTML = `${action.icon ? '<span class="h-4 w-4"></span>' : ""}${action.label}`
        measureRef.appendChild(btn)
        const btnWidth = btn.offsetWidth
        measureRef.removeChild(btn)

        const neededWidth =
          totalWidth + btnWidth + (count > 0 ? 8 : 0) + reservedWidth
        if (neededWidth > containerWidth && i < actions.length - 1) {
          break
        }
        totalWidth += btnWidth + (count > 0 ? 8 : 0)
        count++
      }

      // if all actions fit without the menu, don't reserve space for menu
      measureRef.innerHTML = ""
      let allFitWidth = 0
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i]!
        const btn = document.createElement("button")
        btn.className =
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-8 px-3"
        btn.innerHTML = `${action.icon ? '<span class="h-4 w-4"></span>' : ""}${action.label}`
        measureRef.appendChild(btn)
        allFitWidth += btn.offsetWidth + (i > 0 ? 8 : 0)
        measureRef.removeChild(btn)
      }

      if (allFitWidth <= containerWidth) {
        setVisibleCount(actions.length)
      } else {
        setVisibleCount(Math.max(0, count))
      }
    }

    const observer = new ResizeObserver(updateVisibleCount)
    observer.observe(container)
    updateVisibleCount()

    return () => {
      observer.disconnect()
      if (measureRef.parentNode) {
        measureRef.parentNode.removeChild(measureRef)
      }
    }
  }, [actions])

  const visibleActions = actions.slice(0, visibleCount)
  const overflowActions = actions.slice(visibleCount)

  return (
    <div
      ref={containerRef}
      className="ml-auto flex shrink items-center gap-2 overflow-hidden"
    >
      {visibleActions.map((action, idx) => (
        <Button
          key={idx}
          size="sm"
          variant={action.variant ?? "outline"}
          onClick={action.onClick}
          disabled={action.disabled}
          className="shrink-0"
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
      {overflowActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="sm" variant="outline" className="shrink-0 px-2">
                <IconDotsVertical className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {overflowActions.map((action, idx) => (
              <DropdownMenuItem
                key={idx}
                onClick={action.onClick}
                disabled={action.disabled}
                className={
                  action.variant === "destructive" ? "text-destructive" : ""
                }
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
