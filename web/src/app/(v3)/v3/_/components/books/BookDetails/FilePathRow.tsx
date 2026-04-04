import { IconAlertTriangle } from "@tabler/icons-react"

import { Badge } from "@v3/_/components/ui/badge"

export function FilePathRow({
  label,
  filepath,
  missing,
}: {
  label: string
  filepath: string
  missing: boolean | null
}) {
  const lastSlash = filepath.lastIndexOf("/")
  const directory = lastSlash >= 0 ? filepath.slice(0, lastSlash + 1) : ""
  const filename = lastSlash >= 0 ? filepath.slice(lastSlash + 1) : filepath

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground font-sans text-xs font-semibold uppercase">
          {label}
        </span>

        {!!missing && (
          <Badge variant="destructive" className="h-4 gap-0.5 px-1 text-[10px]">
            <IconAlertTriangle className="h-2.5 w-2.5" />
            Missing
          </Badge>
        )}
      </div>

      <div className="text-sm" title={filepath}>
        <span className="text-muted-foreground">{directory}</span>
        <code className="font-mono font-medium">{filename}</code>
      </div>
    </div>
  )
}
