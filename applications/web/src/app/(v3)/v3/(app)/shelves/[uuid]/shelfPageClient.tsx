"use client"

import { useRouter } from "next/navigation"

import { BookListPage } from "@v3/_/components/books/BookListPage"
import { ShelfActionsMenu } from "@v3/_/components/shelves/ShelfActionsMenu"
import { Button } from "@v3/_/components/ui/button"
import { V3Link } from "@v3/_/components/v3-link"
import { useVersionBasePath } from "@v3/_/components/version-context"
import { useTranslation } from "@v3/_/hooks/use-translation"

import * as icon from "@/icons"
import { useListUserShelvesQuery } from "@/store/api"
import { extractEmojiIcon } from "@/strings"
import { type UUID } from "@/uuid"

export function ShelfPageClient({ shelfUuid }: { shelfUuid: UUID }) {
  const t = useTranslation("ShelfPage")
  const router = useRouter()
  const basePath = useVersionBasePath()

  const { data: shelves = [] } = useListUserShelvesQuery()

  const shelf = shelves.find((s) => s.uuid === shelfUuid)
  const shelfName = shelf
    ? extractEmojiIcon(shelf.name).label || shelf.name
    : "Shelf"

  return (
    <BookListPage
      source={{ kind: "shelf", shelfUuid }}
      breadcrumbs={[
        { label: t("breadcrumb"), url: "/shelves" },
        { label: shelfName },
      ]}
      headerActions={
        <>
          <Button
            variant="ghost"
            size="sm"
            render={
              <V3Link href={`/shelves?item=${shelfUuid}`}>
                <icon.ArrowRight className="mr-1 size-3.5" />
                {t("goToAllShelves")}
              </V3Link>
            }
          />
          <ShelfActionsMenu
            shelf={shelf}
            onDeleted={() => {
              router.push(`${basePath}/shelves`)
            }}
          />
        </>
      }
      beforeFilters={
        shelf?.description ? (
          <p className="text-muted-foreground max-w-md px-4 text-sm">
            {shelf.description}
          </p>
        ) : null
      }
      filtersClassName="pt-1"
      emptyMessage={t.plain("emptyShelf")}
      emptyFilteredSubMessage={t.plain("adjustFilters")}
    />
  )
}
