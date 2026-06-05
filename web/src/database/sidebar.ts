import { type Transaction } from "kysely"

import { type UUID } from "@/uuid"

import { db } from "./connection"
import { type DB } from "./schema"

// builtin items reference a route, not an entity, so a stable string key is
// safe. collection/shelf items carry a real FK (referential integrity).
export type SidebarItemKind = "builtin" | "collection" | "shelf"

// canonical default order, mirroring the previously-hardcoded sidebar nav.
// the frontend registry maps each key to its icon, label and href.
export const DEFAULT_SIDEBAR_BUILTINS = [
  "home",
  "books",
  "series",
  "authors",
  "narrators",
  "translators",
  "tags",
  "publication-years",
  "ratings",
  "statuses",
] as const

export type SidebarItemInput = {
  kind: SidebarItemKind
  builtinKey?: string | null
  collectionUuid?: UUID | null
  shelfUuid?: UUID | null
  hidden?: boolean
}

export type SidebarItemWithDetails = Awaited<
  ReturnType<typeof getSidebarItems>
>[number]

export async function getSidebarItems(userId: UUID) {
  const items = await db
    .selectFrom("sidebarItem")
    .leftJoin("collection", "collection.uuid", "sidebarItem.collectionUuid")
    .leftJoin("shelf", "shelf.uuid", "sidebarItem.shelfUuid")
    .select([
      "sidebarItem.uuid",
      "sidebarItem.kind",
      "sidebarItem.builtinKey",
      "sidebarItem.collectionUuid",
      "sidebarItem.shelfUuid",
      "sidebarItem.position",
      "sidebarItem.hidden",
      "collection.name as collectionName",
      "shelf.name as shelfName",
    ])
    .where("sidebarItem.userId", "=", userId)
    .orderBy("sidebarItem.position", "asc")
    .execute()

  return items.map((item) => ({
    uuid: item.uuid,
    kind: item.kind as SidebarItemKind,
    builtinKey: item.builtinKey,
    collectionUuid: item.collectionUuid,
    shelfUuid: item.shelfUuid,
    position: item.position,
    hidden: item.hidden !== 0,
    // entity items expose the live name, builtins resolve their label client-side
    name: item.collectionName ?? item.shelfName ?? null,
  }))
}

export async function setSidebarItems(
  userId: UUID,
  items: SidebarItemInput[],
  tr?: Transaction<DB>,
) {
  const run = async (trx: Transaction<DB>) => {
    await trx.deleteFrom("sidebarItem").where("userId", "=", userId).execute()

    if (items.length === 0) return

    await trx
      .insertInto("sidebarItem")
      .values(
        items.map((item, index) => ({
          userId,
          kind: item.kind,
          builtinKey: item.builtinKey ?? null,
          collectionUuid: item.collectionUuid ?? null,
          shelfUuid: item.shelfUuid ?? null,
          position: index,
          hidden: item.hidden ? 1 : 0,
        })),
      )
      .execute()
  }

  if (tr) return run(tr)
  await db.transaction().execute(run)
}

export async function initializeDefaultSidebar(userId: UUID) {
  const existing = await db
    .selectFrom("sidebarItem")
    .select(["uuid"])
    .where("userId", "=", userId)
    .executeTakeFirst()

  if (existing) return

  await setSidebarItems(
    userId,
    DEFAULT_SIDEBAR_BUILTINS.map((builtinKey) => ({
      kind: "builtin" as const,
      builtinKey,
    })),
  )
}
