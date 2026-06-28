import { type Transaction } from "kysely"

import { type UUID } from "@/uuid"

import { db } from "./connection"
import { type DB } from "./schema"

export type SidebarItemKind = "builtin" | "collection" | "shelf"

export const DEFAULT_SIDEBAR_BUILTINS = [
  "home",
  "books",
  "alignment-quality",
  "series",
  "authors",
  "narrators",
  "translators",
  "tags",
  "publication-years",
  "ratings",
  "statuses",
  "formats",
] as const

const MAIN_BUILTINS = new Set<string>(["home", "books", "alignment-quality"])

export type SidebarItemInput = {
  kind: SidebarItemKind
  builtinKey?: string | null
  collectionUuid?: string | null
  shelfUuid?: string | null
  hidden?: boolean
}

export type SidebarGroupInput = {
  uuid?: string | null
  name: string
  collapsed?: boolean
  items: SidebarItemInput[]
}

export type SidebarGroupWithItems = {
  uuid: string
  name: string
  position: number
  collapsed: boolean
  items: SidebarItemDetail[]
}

export type SidebarItemDetail = {
  uuid: string
  kind: SidebarItemKind
  builtinKey: string | null
  collectionUuid: string | null
  shelfUuid: string | null
  position: number
  hidden: boolean
  name: string | null
  icon: string | null
  color: string | null
}

export type SidebarItemWithDetails = SidebarItemDetail & {
  groupUuid: string | null
}

export async function getSidebarGroups(
  userId: UUID,
): Promise<SidebarGroupWithItems[]> {
  const groups = await db
    .selectFrom("sidebarGroup")
    .selectAll()
    .where("userId", "=", userId)
    .orderBy("position", "asc")
    .execute()

  if (groups.length === 0) return []

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
      "sidebarItem.groupUuid",
      "collection.name as collectionName",
      "collection.icon as collectionIcon",
      "collection.color as collectionColor",
      "shelf.name as shelfName",
      "shelf.icon as shelfIcon",
      "shelf.color as shelfColor",
    ])
    .where("sidebarItem.userId", "=", userId)
    .orderBy("sidebarItem.position", "asc")
    .execute()

  const itemsByGroup = new Map<string, SidebarItemDetail[]>()

  for (const group of groups) {
    itemsByGroup.set(group.uuid, [])
  }

  for (const item of items) {
    const groupUuid = item.groupUuid
    if (!groupUuid) continue

    const groupItems = itemsByGroup.get(groupUuid)
    if (!groupItems) continue

    groupItems.push({
      uuid: item.uuid,
      kind: item.kind as SidebarItemKind,
      builtinKey: item.builtinKey,
      collectionUuid: item.collectionUuid,
      shelfUuid: item.shelfUuid,
      position: item.position,
      hidden: item.hidden !== 0,
      name: item.collectionName ?? item.shelfName ?? null,
      icon: item.collectionIcon ?? item.shelfIcon ?? null,
      color: item.collectionColor ?? item.shelfColor ?? null,
    })
  }

  return groups.map((group) => ({
    uuid: group.uuid,
    name: group.name,
    position: group.position,
    collapsed: group.collapsed !== 0,
    items: itemsByGroup.get(group.uuid) ?? [],
  }))
}

// backwards-compatible flat list used by existing code paths
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
      "sidebarItem.groupUuid",
      "collection.name as collectionName",
      "collection.icon as collectionIcon",
      "collection.color as collectionColor",
      "shelf.name as shelfName",
      "shelf.icon as shelfIcon",
      "shelf.color as shelfColor",
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
    groupUuid: item.groupUuid,
    name: item.collectionName ?? item.shelfName ?? null,
    icon: item.collectionIcon ?? item.shelfIcon ?? null,
    color: item.collectionColor ?? item.shelfColor ?? null,
  }))
}

export type SidebarItemWithGroupDetails = Awaited<
  ReturnType<typeof getSidebarItems>
>[number]

export async function setSidebarGroups(
  userId: UUID,
  groups: SidebarGroupInput[],
  tr?: Transaction<DB>,
) {
  const run = async (trx: Transaction<DB>) => {
    await trx.deleteFrom("sidebarItem").where("userId", "=", userId).execute()
    await trx.deleteFrom("sidebarGroup").where("userId", "=", userId).execute()

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi]!
      const groupUuid = group.uuid ?? crypto.randomUUID()

      await trx
        .insertInto("sidebarGroup")
        .values({
          uuid: groupUuid,
          userId,
          name: group.name,
          position: gi,
          collapsed: group.collapsed ? 1 : 0,
        })
        .execute()

      if (group.items.length === 0) continue

      await trx
        .insertInto("sidebarItem")
        .values(
          group.items.map((item, index) => ({
            userId,
            groupUuid,
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
  }

  if (tr) return run(tr)
  await db.transaction().execute(run)
}

// legacy flat setter kept for backwards compatibility during transition
export async function setSidebarItems(
  userId: UUID,
  items: SidebarItemInput[],
  tr?: Transaction<DB>,
) {
  const mainItems: SidebarItemInput[] = []
  const libraryItems: SidebarItemInput[] = []

  for (const item of items) {
    const isMain =
      item.kind === "builtin" && MAIN_BUILTINS.has(item.builtinKey ?? "")

    if (isMain) {
      mainItems.push(item)
    } else {
      libraryItems.push(item)
    }
  }

  await setSidebarGroups(
    userId,
    [
      { name: "Main", items: mainItems },
      { name: "Library", items: libraryItems },
    ],
    tr,
  )
}

export async function toggleGroupCollapsed(
  groupUuid: string,
  collapsed: boolean,
) {
  await db
    .updateTable("sidebarGroup")
    .set({ collapsed: collapsed ? 1 : 0 })
    .where("uuid", "=", groupUuid)
    .execute()
}

export async function initializeDefaultSidebar(userId: UUID) {
  const existing = await db
    .selectFrom("sidebarGroup")
    .select(["uuid"])
    .where("userId", "=", userId)
    .executeTakeFirst()

  if (existing) return

  // check for accessible collections
  const collections = await db
    .selectFrom("collection")
    .select(["collection.uuid", "collection.name"])
    .leftJoin(
      "collectionToUser",
      "collection.uuid",
      "collectionToUser.collectionUuid",
    )
    .where((eb) =>
      eb.or([
        eb("collectionToUser.userId", "=", userId),
        eb("collection.public", "=", true),
      ]),
    )
    .groupBy("collection.uuid")
    .execute()

  const mainItems: SidebarItemInput[] = DEFAULT_SIDEBAR_BUILTINS.filter((key) =>
    MAIN_BUILTINS.has(key),
  ).map((builtinKey) => ({ kind: "builtin" as const, builtinKey }))

  const libraryItems: SidebarItemInput[] = DEFAULT_SIDEBAR_BUILTINS.filter(
    (key) => !MAIN_BUILTINS.has(key),
  ).map((builtinKey) => ({ kind: "builtin" as const, builtinKey }))

  const groups: SidebarGroupInput[] = [
    { name: "Main", items: mainItems },
    { name: "Library", items: libraryItems },
  ]

  if (collections.length > 0) {
    groups.push({
      name: "Collections",
      items: collections.map((c) => ({
        kind: "collection" as const,
        collectionUuid: c.uuid as UUID,
      })),
    })
  }

  await setSidebarGroups(userId, groups)
}
