import {
  IconCheck,
  IconChevronDown,
  IconPointer,
  IconSquare,
  IconSquareCheck,
  IconX,
} from "@tabler/icons-react"

import { ActionBar } from "@v3/_/components/ui/action-bar"
import { Button } from "@v3/_/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { useListBooksQuery } from "@/store/api"

import { useBookActionItems } from "./BookActionMenuItems"

type SelectionToolbarProps = {
  allBookUuids: string[]
  className?: string
}

export function SelectionToolbar({
  allBookUuids,
  className,
}: SelectionToolbarProps) {
  const t = useTranslation("SelectionToolbar")

  const {
    selectedBooks,
    isSelecting,
    selectAll,
    selectNone,
    invertSelection,
    stopSelecting,
  } = useBookSelection()

  const { data: allBooks = [] } = useListBooksQuery()
  const selectedBookObjects = allBooks.filter((book) =>
    selectedBooks.has(book.uuid),
  )

  const { items, dialogs } = useBookActionItems({
    books: selectedBookObjects,
    mode: "bulk",
    onAfterDestructive: selectNone,
  })

  return (
    <>
      <ActionBar
        show={isSelecting}
        className={cn(
          "fixed bottom-4 left-1/2 -translate-x-1/2 gap-1",
          className,
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm">
                <IconSquareCheck className="mr-2 h-4 w-4" />
                {t("select")}
                <IconChevronDown className="ml-2 h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => {
                selectAll(allBookUuids)
              }}
            >
              <IconCheck className="mr-2 h-4 w-4" />
              {t("selectAll")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={selectNone}>
              <IconSquare className="mr-2 h-4 w-4" />
              {t("selectNone")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                invertSelection(allBookUuids)
              }}
            >
              <IconSquareCheck className="mr-2 h-4 w-4" />
              {t("invertSelection")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="px-2 font-sans text-xs whitespace-nowrap">
          {t("selected", { count: selectedBooks.size })}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                disabled={selectedBooks.size === 0}
              >
                <IconPointer className="mr-2 h-4 w-4" />
                {t("actions")}
                <IconChevronDown className="ml-2 h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="min-w-48">
            {items}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" onClick={stopSelecting}>
          <IconX className="h-4 w-4" />
        </Button>
      </ActionBar>

      {dialogs}
    </>
  )
}
