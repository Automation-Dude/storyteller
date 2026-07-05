"use client"

import {
  IconArrowUpRight,
  IconDotsVertical,
  IconEdit,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"

import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"

import { type BookWithRelations } from "@/database/books"
import { usePermission } from "@/hooks/usePermission"

import {
  ActionEntryList,
  type BookActionEntry,
  useBookActionItems,
} from "./BookActionMenuItems"
import { FilterableMenu } from "../../ui/filterable-menu"
import { TooltipButton } from "../../ui/tooltip-button"

export function BookActionsMenu({
  book,
  showOpenFullPage = false,
  onEdit,
  onDeleted,
  fullPageHref,
  className,
  open,
  onOpenChange,
}: {
  book: BookWithRelations
  showOpenFullPage?: boolean
  onEdit?: () => void
  // called after the book is deleted, so the panel/page can close or navigate
  onDeleted?: () => void
  fullPageHref?: string
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const t = useTranslation("BookActions")
  const c = useCommon()
  const router = useRouter()
  const canEdit = usePermission("bookUpdate")
  const { entries, dialogs } = useBookActionItems({
    books: [book],
    mode: "single",
    onAfterDestructive: onDeleted,
  })

  const leading: BookActionEntry[] = []
  if (showOpenFullPage) {
    leading.push({
      key: "openFullPage",
      label: t.plain("openFullPage"),
      icon: <IconArrowUpRight className="size-4" />,
      onSelect: () => {
        router.push(fullPageHref ?? `/v3/books/${book.uuid}`)
      },
    })
  }
  if (onEdit && canEdit) {
    leading.push({
      key: "edit",
      label: c.plain("actions.edit"),
      icon: <IconEdit className="size-4" />,
      onSelect: onEdit,
    })
  }

  return (
    <>
      <FilterableMenu
        open={open}
        onOpenChange={onOpenChange}
        align="end"
        searchable
        searchPlaceholder={t.plain("search")}
        trigger={
          <TooltipButton
            variant="real-ghost"
            size="icon-sm"
            className={className}
            tooltip="Open actions"
            aria-label="Open book actions menu"
            shortcut={["E"]}
          >
            <IconDotsVertical className="size-3.5 stroke-[1.5]" />
            <span className="sr-only">Open book actions menu</span>
          </TooltipButton>
        }
      >
        <ActionEntryList entries={[...leading, ...entries]} />
      </FilterableMenu>

      {dialogs}
    </>
  )
}
