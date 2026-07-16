"use client"

import { useRouter } from "next/navigation"

import { BookListPage } from "@v3/_/components/books/BookListPage"
import { EntityActionsMenu } from "@v3/_/components/library/EntityActionsMenu"
import { librarySections } from "@v3/_/components/library/library-sections"
import { Button } from "@v3/_/components/ui/button"
import { V3Link } from "@v3/_/components/v3-link"
import { useVersionBasePath } from "@v3/_/components/version-context"
import { useTranslation } from "@v3/_/hooks/use-translation"

import * as icon from "@/icons"
import { useListCollectionsQuery } from "@/store/api"
import { extractEmojiIcon } from "@/strings"
import { type UUID } from "@/uuid"

export function CollectionStandalonePage({
  collectionUuid,
}: {
  collectionUuid: UUID
}) {
  const t = useTranslation("CollectionPage")
  const router = useRouter()
  const basePath = useVersionBasePath()

  const { data: collections = [] } = useListCollectionsQuery()
  const collection = collections.find((c) => c.uuid === collectionUuid)

  const collectionName = collection
    ? extractEmojiIcon(collection.name).label || collection.name
    : "Collection"

  return (
    <BookListPage
      source={{ kind: "books", collectionContext: collectionUuid }}
      breadcrumbs={[
        { label: t("breadcrumb"), url: "/collections" },
        { label: collectionName },
      ]}
      headerActions={
        <>
          <Button
            variant="ghost"
            size="sm"
            render={
              <V3Link href={`/collections?item=${collectionUuid}`}>
                <icon.ArrowRight className="mr-1 size-3.5" />
                {t("goToAllCollections")}
              </V3Link>
            }
          />
          <EntityActionsMenu
            entityType="collection"
            item={{ key: collectionUuid, name: collectionName, bookCount: 0 }}
            toShelfFilter={librarySections.collections.toShelfFilter}
            onDeleted={() => {
              router.push(`${basePath}/collections`)
            }}
          />
        </>
      }
      beforeFilters={
        collection?.description ? (
          <p className="text-muted-foreground max-w-md px-4 text-sm">
            {collection.description}
          </p>
        ) : null
      }
      filtersClassName="pt-1"
      emptyMessage={t.plain("emptyCollection")}
      emptyFilteredSubMessage={t.plain("adjustFilters")}
    />
  )
}
