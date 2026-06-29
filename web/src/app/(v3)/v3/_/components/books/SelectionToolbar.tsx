import {
  IconCheck,
  IconChevronDown,
  IconPointer,
  IconSquare,
  IconSquareCheck,
  IconX,
} from "@tabler/icons-react"

import { ActionBar } from "@v3/_/components/ui/action-bar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
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
  const c = useCommon()

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
      <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
        <ActionBar show={isSelecting} className={cn("gap-1 py-1", className)}>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <TooltipButton
                  tooltip={c("actions.select")}
                  aria-label={c("actions.select")}
                  variant="real-ghost"
                  size="sm"
                  className="gap-1 rounded-full"
                >
                  <IconSquareCheck className="size-4 stroke-[1.5]" />
                  <IconChevronDown className="size-3" />
                </TooltipButton>
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

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <TooltipButton
                  tooltip={t("actions")}
                  aria-label={t("actions")}
                  variant="real-ghost"
                  className="gap-1 rounded-full"
                  disabled={selectedBooks.size === 0}
                >
                  <IconPointer className="size-4 stroke-[1.5]" />
                  <IconChevronDown className="size-3" />
                </TooltipButton>
              }
            />
            <DropdownMenuContent align="start" className="min-w-48">
              {items}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="px-2 font-sans text-xs whitespace-nowrap">
            {c("selectedCount", { count: selectedBooks.size })}
          </span>
        </ActionBar>
        <ActionBar show={isSelecting} className="p-1">
          <TooltipButton
            tooltip={t("cancelSelection")}
            aria-label={t("cancelSelection")}
            variant="ghost"
            onClick={stopSelecting}
            className="rounded-full p-2 hover:bg-transparent"
          >
            <IconX className="size-4 stroke-[1.5]" />
          </TooltipButton>
        </ActionBar>
      </div>

      {dialogs}
    </>
  )
}
