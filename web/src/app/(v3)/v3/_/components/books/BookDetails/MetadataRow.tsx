"use client"

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
    <>
      <span className="text-muted-foreground text-xs uppercase">{label}</span>
      <div className="text-sm leading-0">{children}</div>
    </>
  )
}
