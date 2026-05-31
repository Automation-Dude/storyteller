export function FilePathRow({
  label,
  filepath,
}: {
  label: string
  filepath: string
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
      </div>

      <div className="text-sm" title={filepath}>
        <span className="text-muted-foreground">{directory}</span>
        <code className="font-mono font-medium">{filename}</code>
      </div>
    </div>
  )
}
