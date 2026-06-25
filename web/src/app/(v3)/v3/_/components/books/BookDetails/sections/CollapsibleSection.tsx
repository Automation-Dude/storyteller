import { IconChevronDown } from "@tabler/icons-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@v3/_/components/ui/collapsible"

export function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
  className,
  rightElement,
}: {
  title: string
  name: string
  icon?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
  rightElement?: React.ReactNode
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div className="group/section">
        <CollapsibleTrigger className="mb-3 flex w-full cursor-pointer items-center justify-between gap-3">
          <span className="section-label flex flex-1 items-center gap-2">
            {icon}
            {title}
          </span>

          <div className="flex items-center gap-2">
            {rightElement}
            <IconChevronDown className="text-muted-foreground size-3.5 stroke-[1.5] transition-transform group-data-open/section:rotate-180 in-data-open:rotate-180" />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className={className}>
          {children}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
