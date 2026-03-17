import { IconSearch, IconX } from "@tabler/icons-react"

import { Button } from "@/app/(v3)/v3/_/components/ui/button"
import { Input } from "@/app/(v3)/v3/_/components/ui/input"
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
    <div className="relative flex-1 sm:max-w-sm">
      <IconSearch className="text-muted-foreground absolute top-1/2 left-1 h-4 w-4 -translate-y-1/2" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
        }}
        className={cn(
          "rounded-b-none border-0 border-b bg-transparent px-7",
          className,
        )}
      />
      {value && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 p-0"
          onClick={() => {
            onChange("")
          }}
        >
          <IconX className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
