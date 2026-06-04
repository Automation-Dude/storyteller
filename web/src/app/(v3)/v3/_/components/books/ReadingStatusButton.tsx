import { IconBook, IconChevronDown } from "@tabler/icons-react"
import { useCallback } from "react"

import { Button } from "@v3/_/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"

import { cn } from "@/cn"
import { type BookWithRelations } from "@/database/books"
import { useListStatusesQuery, useUpdateStatusMutation } from "@/store/api"
import { useCoverColors } from "./BookDetails/sections/useCoverColors"

export function ReadingStatusButton({
  book,
  size,
  onStatusChange,
}: {
  book: BookWithRelations
  size?: "sm" | "default" | "lg"
  onStatusChange?: () => void
}) {
  const { data: statuses = [] } = useListStatusesQuery()
  const [updateStatus] = useUpdateStatusMutation()

  const currentStatus = book.status

  const coverColors = useCoverColors(book)

  const handleStatusChange = useCallback(
    async (statusUuid: string) => {
      await updateStatus({
        bookUuid: book.uuid,
        statusUuid:
          statusUuid as `${string}-${string}-${string}-${string}-${string}`,
      })
      onStatusChange?.()
    },
    [book.uuid, updateStatus, onStatusChange],
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            style={{
              color: coverColors.primary.isDark
                ? coverColors.primary.solid
                : "black",
              borderColor: coverColors.primary.isDark
                ? coverColors.primary.solid
                : "black",
            }}
            size={size}
            className={cn(
              "gap-2",
              // currentStatus && "border-primary bg-primary/5 text-primary",
            )}
          >
            <IconBook className="h-4 w-4" />
            {currentStatus?.name ?? "Set Status"}
            <IconChevronDown className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {statuses.map((status) => (
          <DropdownMenuItem
            key={status.uuid}
            onClick={() => handleStatusChange(status.uuid)}
            className={cn(
              String(currentStatus?.uuid) === status.uuid && "bg-accent",
            )}
          >
            {status.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
