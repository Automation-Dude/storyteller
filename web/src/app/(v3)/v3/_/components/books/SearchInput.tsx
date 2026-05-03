import { IconSearch, IconX } from "@tabler/icons-react"

import { Button } from "@/app/(v3)/v3/_/components/ui/button"
import { cn } from "@/app/(v3)/v3/_/lib/utils"

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "bg-card border-border focus-within:border-primary focus-within:ring-primary/15 relative flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 transition-[border-color,box-shadow] focus-within:ring-2",
        className,
      )}
    >
      <IconSearch className="text-muted-foreground h-4 w-4 shrink-0" />
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
        }}
        className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-xs outline-none"
      />
      {value && (
        <Button
          variant="ghost"
          size="xs"
          className="size-4 shrink-0 p-0"
          onClick={() => {
            onChange("")
          }}
        >
          <IconX className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
