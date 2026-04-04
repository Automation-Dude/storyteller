"use client"
import { cn } from "@/cn"

export function MetadataRow({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
  className?: string
}) {
  if (!children) return null

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-muted-foreground flex items-center gap-2 font-sans text-xs font-semibold tracking-wide uppercase">
        <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
        {label}
      </span>
      <div className="text-sm">{children}</div>
    </div>
  )
}
