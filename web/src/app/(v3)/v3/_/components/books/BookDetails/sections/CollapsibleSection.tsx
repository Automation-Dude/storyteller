import { IconChevronDown } from "@tabler/icons-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@v3/_/components/ui/collapsible"
import { useState } from "react"
import { Button } from "../../../ui/button"
import { cn } from "@/cn"

export function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
  className,
  rightElement,
}: {
  title: string
  // optional stable key for the section; currently unused but kept so callers
  // can label sections without a type error
  name?: string
  icon?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
  rightElement?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="group/section">
        <div className="relative mb-3 flex items-center gap-3">
          <CollapsibleTrigger
            className="flex h-full w-full cursor-pointer items-center justify-between gap-3"
            aria-label={"Toggle section"}
          >
            <span className="section-label flex flex-1 items-center gap-2">
              {icon}
              {title}
            </span>
          </CollapsibleTrigger>
          <div className="flex items-center gap-1">
            {rightElement}
            <Button
              variant="ghost"
              size="icon-xs"
              aria-hidden="true"
              onClick={() => {
                setIsOpen((prev) => !prev)
              }}
            >
              <IconChevronDown
                className={cn(
                  "text-muted-foreground size-3.5 stroke-[1.5]",
                  isOpen && "rotate-180",
                )}
              />
            </Button>
          </div>
        </div>

        <CollapsibleContent className={className}>
          {children}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
