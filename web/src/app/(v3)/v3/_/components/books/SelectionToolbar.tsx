import { useHotkey } from "@tanstack/react-hotkeys"

import { ActionTray } from "@v3/_/components/ui/action-tray"
import { Button } from "@v3/_/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { useBookSelection } from "@v3/_/hooks/use-book-selection"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import {
  FilterableMenu,
  FilterableMenuContent,
  FilterableMenuTrigger,
} from "@/app/(v3)/v3/_/components/ui/filterable-menu"
import { TooltipButton } from "@/app/(v3)/v3/_/components/ui/tooltip-button"
import * as icon from "@/icons"

import {
  ActionEntryList,
  useBookActionItems,
} from "./ActionMenu/BookActionMenuItems"
import { BookWithRelations } from "@/database/books"

type SelectionToolbarProps = {
  allBooks: BookWithRelations[]
  className?: string
}

// docked to the bottom of the grid column (sticky) rather than floating over the
// whole screen -- it shares the workspace surface. a serif selection count sits
// left, then the core select / actions menus, then a close affordance.
export function SelectionToolbar({
  className,
  allBooks,
}: SelectionToolbarProps) {
  const t = useTranslation("SelectionToolbar")
  const tActions = useTranslation("BookActions")
  const c = useCommon()

  const {
    selectedBooks,
    isSelecting,
    selectAll,
    selectNone,
    invertSelection,
    stopSelecting,
  } = useBookSelection()

  // const { data: allBooks = [] } = useListBooksQuery()
  const selectedBookObjects = allBooks.filter((book) =>
    selectedBooks.has(book.uuid),
  )
  useHotkey(
    "Escape",
    () => {
      stopSelecting()
    },
    {
      conflictBehavior: "replace",
    },
  )

  const { entries, dialogs } = useBookActionItems({
    books: selectedBookObjects,
    mode: "bulk",
    onAfterDestructive: selectNone,
  })

  const hasSelection = selectedBooks.size > 0
  const divider = <div className="bg-border/70 mx-1 h-5 w-px shrink-0" />

  return (
    <>
      <div className="@container pointer-events-none sticky inset-x-0 bottom-0 z-40 flex justify-center px-2">
        <ActionTray
          show={isSelecting}
          className={cn(
            "pointer-events-auto max-w-full min-w-0 gap-1.5 pr-1.5 pl-4",
            className,
          )}
        >
          <span className="font-heading mr-1 min-w-0 truncate text-sm">
            {t.rich("selectedBooks", {
              count: selectedBooks.size,
              sel: (chunks) => <span className="italic">{chunks}</span>,
            })}
          </span>

          {divider}

          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="real-ghost"
                  size="sm"
                  className="shrink-0 gap-1.5 rounded-md"
                >
                  <icon.SquareCheck className="size-3.5 stroke-[1.5]" />
                  <span className="hidden @md:inline">
                    {c("actions.select")}
                  </span>
                  <icon.ChevronDown className="size-3 opacity-60" />
                </Button>
              }
            />
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => {
                  selectAll(allBookUuids)
                }}
              >
                <icon.Check className="mr-2 h-4 w-4" />
                {t("selectAll")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={selectNone}>
                <icon.Square className="mr-2 h-4 w-4" />
                {t("selectNone")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  invertSelection(allBookUuids)
                }}
              >
                <icon.SquareCheck className="mr-2 h-4 w-4" />
                {t("invertSelection")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <FilterableMenu>
            <FilterableMenuTrigger
              render={
                <Button
                  variant="real-ghost"
                  size="sm"
                  className="shrink-0 gap-1.5 rounded-md"
                  disabled={!hasSelection}
                >
                  <icon.Pointer className="size-3.5 stroke-[1.5]" />
                  <span className="hidden @md:inline">{t("actions")}</span>
                  <icon.ChevronDown className="size-3 opacity-60" />
                </Button>
              }
            />
            <FilterableMenuContent
              searchPlaceholder={tActions.plain("search")}
              align="start"
              className="min-w-48"
            >
              <ActionEntryList entries={entries} />
            </FilterableMenuContent>
          </FilterableMenu>

          {divider}

          <TooltipButton
            tooltip={t("cancelSelection")}
            aria-label={t("cancelSelection")}
            variant="real-ghost"
            size="icon-sm"
            onClick={stopSelecting}
            className="shrink-0 rounded-full"
            shortcut={["Escape"]}
          >
            <icon.Close className="size-4 stroke-[1.5]" />
          </TooltipButton>
        </ActionTray>
      </div>

      {dialogs}
    </>
  )
}
