"use client"

import {
  IconArrowUpRight,
  IconDotsVertical,
  IconEdit,
} from "@tabler/icons-react"
import Link from "next/link"

import { Button } from "@v3/_/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"

import { type BookWithRelations } from "@/database/books"
import { usePermission } from "@/hooks/usePermission"

import { useBookActionItems } from "./BookActionMenuItems"

export function BookActionsMenu({
  book,
  showOpenFullPage = false,
  onEdit,
  onDeleted,
  fullPageHref,
  className,
}: {
  book: BookWithRelations
  showOpenFullPage?: boolean
  onEdit?: () => void
  // called after the book is deleted, so the panel/page can close or navigate
  onDeleted?: () => void
  fullPageHref?: string
  className?: string
}) {
  const t = useTranslation("BookActions")
  const c = useCommon()
  const canEdit = usePermission("bookUpdate")
  const { items, dialogs } = useBookActionItems({
    books: [book],
    mode: "single",
    onAfterDestructive: onDeleted,
  })

  const hasTopItems = showOpenFullPage || (!!onEdit && canEdit)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="real-ghost" size="icon-sm" className={className}>
              <IconDotsVertical className="size-3.5 stroke-[1.5]" />
              <span className="sr-only">Open book actions menu</span>
            </Button>
          }
        />

        <DropdownMenuContent
          align="end"
          className="pointer-events-auto z-100 min-w-48"
        >
          {showOpenFullPage && (
            <DropdownMenuItem
              render={
                <Link href={fullPageHref ?? `/v3/books/${book.uuid}`}>
                  <IconArrowUpRight className="mr-2 h-4 w-4" />
                  {t("openFullPage")}
                </Link>
              }
            />
          )}

          {onEdit && canEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              {c("actions.edit")}
            </DropdownMenuItem>
          )}

          {hasTopItems && <DropdownMenuSeparator />}

          {items}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogs}
    </>
  )
}
