"use client"

import { IconArrowUpRight, IconDotsVertical, IconEdit } from "@tabler/icons-react"
import Link from "next/link"

import { Button } from "@v3/_/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type BookWithRelations } from "@/database/books"

import { useBookActionItems } from "./BookActionMenuItems"

// the single-book "..." menu. holds every action the bulk toolbar has (minus
// merge) plus the single-only "open full page" and "edit" entries. used by both
// the panel header and the full-page header so a book has one action surface.
export function BookActionsMenu({
  book,
  showOpenFullPage = false,
  onEdit,
  onDeleted,
  fullPageHref,
}: {
  book: BookWithRelations
  showOpenFullPage?: boolean
  onEdit?: () => void
  // called after the book is deleted, so the panel/page can close or navigate
  onDeleted?: () => void
  fullPageHref?: string
}) {
  const t = useTranslation("BookActions")
  const { items, dialogs } = useBookActionItems({
    books: [book],
    mode: "single",
    onAfterDestructive: onDeleted,
  })

  const hasTopItems = showOpenFullPage || !!onEdit

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm">
              <IconDotsVertical className="h-4 w-4" />
            </Button>
          }
        />

        <DropdownMenuContent align="end" className="min-w-48">
          {showOpenFullPage && (
            <DropdownMenuItem
              render={
                <Link href={fullPageHref ?? `/v3/books/${book.uuid}`}>
                  <IconArrowUpRight className="mr-2 h-4 w-4" />
                  {t.plain("openFullPage")}
                </Link>
              }
            />
          )}

          {onEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              {t.plain("edit")}
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
