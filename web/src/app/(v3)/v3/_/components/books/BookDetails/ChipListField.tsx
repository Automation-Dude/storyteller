"use client"

import { IconPlus, IconX } from "@tabler/icons-react"
import { useRef } from "react"

import { Badge } from "@v3/_/components/ui/badge"
import { Button } from "@v3/_/components/ui/button"
import { Input } from "@v3/_/components/ui/input"

type ChipListFieldProps = {
  values: string[]
  onChange: (values: string[]) => void
  label: string
  addPlaceholder: string
}

export function ChipListField({
  values,
  onChange,
  label,
  addPlaceholder,
}: ChipListFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAdd = () => {
    const value = inputRef.current?.value.trim()
    if (!value || !inputRef.current) return

    onChange([...values, value])
    inputRef.current.value = ""
  }

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs font-medium uppercase">
        {label}
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
        {values.map((value, idx) => (
          <Badge key={idx} variant="outline" className="gap-1">
            {value}
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="hover:bg-destructive/20 ml-0.5 rounded-full p-0.5"
            >
              <IconX className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            placeholder={addPlaceholder}
            className="h-7 w-40 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAdd()
              }
            }}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleAdd}
          >
            <IconPlus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
