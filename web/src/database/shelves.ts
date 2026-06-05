import {
  type Insertable,
  type Selectable,
  type Transaction,
  type Updateable,
} from "kysely"
import { jsonArrayFrom } from "kysely/helpers/sqlite"

import { type UUID } from "@/uuid"

import { type BookWithRelations, booksQuery } from "./books"
import { db } from "./connection"
import { type DB } from "./schema"
import {
  type ShelfFilter,
  buildFilterExpression,
  extractEntityReferences,
} from "./shelfFilter"

export type Shelf = Selectable<DB["shelf"]>
export type NewShelf = Insertable<DB["shelf"]>
export type ShelfUpdate = Updateable<DB["shelf"]>

// widget kinds render a custom block, shelf kinds render a book row.
// "communityReading" is reserved for a future social section.
export type HomeSectionKind =
  | "hero"
  | "stats"
  | "currentlyReading"
  | "nextUpInSeries"
  | "recentlyAdded"
  | "custom"

export type HomeSection = Selectable<DB["homeSection"]>
export type NewHomeSection = Insertable<DB["homeSection"]>
export type HomeSectionUpdate = Updateable<DB["homeSection"]>

export type ShelfWithBooks = Awaited<ReturnType<typeof getShelf>>
export type HomeSectionWithDetails = Awaited<
  ReturnType<typeof getHomeSections>
>[number]

export type ShelfOrderBy =
  | "createdAt"
  | "updatedAt"
  | "title"
  | "publicationDate"
  | "rating"
  | "position"

// ---------------------------------------------------------------------------
// shelf crud
// ---------------------------------------------------------------------------

function parseFilter(filter: string | ShelfFilter | null): ShelfFilter | null {
  if (!filter) return null
  if (typeof filter === "object") return filter

  try {
    return JSON.parse(filter) as ShelfFilter
  } catch {
    return null
  }
}

export async function getShelf(uuid: UUID, userId: UUID, tr?: Transaction<DB>) {
  const shelf = await (tr ?? db)
    .selectFrom("shelf")
    .selectAll("shelf")
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom("shelfBook")
          .select(["shelfBook.bookUuid", "shelfBook.position"])
          .whereRef("shelfBook.shelfUuid", "=", "shelf.uuid")
          .orderBy("shelfBook.position", "asc"),
      ).as("books"),
    ])
    .where("shelf.uuid", "=", uuid)
    .where("shelf.userId", "=", userId)
    .executeTakeFirstOrThrow()

  return {
    ...shelf,
    filter: shelf.filter ? parseFilter(shelf.filter) : null,
  }
}

export async function getShelves(userId: UUID) {
  const shelves = await db
    .selectFrom("shelf")
    .selectAll("shelf")
    .select((eb) => [
      jsonArrayFrom(
        eb
          .selectFrom("shelfBook")
          .select(["shelfBook.bookUuid", "shelfBook.position"])
          .whereRef("shelfBook.shelfUuid", "=", "shelf.uuid")
          .orderBy("shelfBook.position", "asc"),
      ).as("books"),
    ])
    .where("shelf.userId", "=", userId)
    .execute()

  return shelves.map((shelf) => ({
    ...shelf,
    filter: shelf.filter ? parseFilter(shelf.filter) : null,
  }))
}

export async function createShelf(
  userId: UUID,
  insert: Omit<NewShelf, "userId">,
  bookUuids?: UUID[],
) {
  return await db.transaction().execute(async (tr) => {
    const filterString = insert.filter
      ? typeof insert.filter === "string"
        ? insert.filter
        : JSON.stringify(insert.filter)
      : null

    const { uuid } = await tr
      .insertInto("shelf")
      .values({
        ...insert,
        userId,
        filter: filterString,
      })
      .returning(["uuid as uuid"])
      .executeTakeFirstOrThrow()

    if (filterString) {
      const filter = JSON.parse(filterString) as ShelfFilter
      const refs = extractEntityReferences(filter)

      if (refs.length > 0) {
        await tr
          .insertInto("shelfFilterReference")
          .values(
            refs.map((ref) => ({
              shelfUuid: uuid,
              entityType: ref.entityType,
              entityUuid: ref.entityUuid,
            })),
          )
          .execute()
      }
    }

    if (bookUuids && bookUuids.length > 0) {
      await tr
        .insertInto("shelfBook")
        .values(
          bookUuids.map((bookUuid, index) => ({
            shelfUuid: uuid,
            bookUuid,
            position: index,
          })),
        )
        .execute()
    }

    return await getShelf(uuid, userId, tr)
  })
}

export async function updateShelf(
  uuid: UUID,
  userId: UUID,
  update: ShelfUpdate,
  bookUuids?: UUID[],
) {
  return await db.transaction().execute(async (tr) => {
    const filterString =
      update.filter !== undefined
        ? update.filter
          ? typeof update.filter === "string"
            ? update.filter
            : JSON.stringify(update.filter)
          : null
        : undefined

    const updateValues = {
      ...update,
      ...(filterString !== undefined ? { filter: filterString } : {}),
    }

    if (Object.keys(updateValues).length > 0) {
      await tr
        .updateTable("shelf")
        .set(updateValues)
        .where("uuid", "=", uuid)
        .where("userId", "=", userId)
        .execute()
    }

    if (filterString !== undefined) {
      await tr
        .deleteFrom("shelfFilterReference")
        .where("shelfUuid", "=", uuid)
        .execute()

      if (filterString) {
        const filter = JSON.parse(filterString) as ShelfFilter
        const refs = extractEntityReferences(filter)

        if (refs.length > 0) {
          await tr
            .insertInto("shelfFilterReference")
            .values(
              refs.map((ref) => ({
                shelfUuid: uuid,
                entityType: ref.entityType,
                entityUuid: ref.entityUuid,
              })),
            )
            .execute()
        }
      }
    }

    if (bookUuids !== undefined) {
      await tr.deleteFrom("shelfBook").where("shelfUuid", "=", uuid).execute()

      if (bookUuids.length > 0) {
        await tr
          .insertInto("shelfBook")
          .values(
            bookUuids.map((bookUuid, index) => ({
              shelfUuid: uuid,
              bookUuid,
              position: index,
            })),
          )
          .execute()
      }
    }

    return await getShelf(uuid, userId, tr)
  })
}

export async function deleteShelf(uuid: UUID, userId: UUID) {
  await db.transaction().execute(async (tr) => {
    await tr.deleteFrom("shelfBook").where("shelfUuid", "=", uuid).execute()

    await tr
      .deleteFrom("shelfFilterReference")
      .where("shelfUuid", "=", uuid)
      .execute()

    await tr
      .deleteFrom("homeSection")
      .where("shelfUuid", "=", uuid)
      .where("userId", "=", userId)
      .execute()

    await tr
      .deleteFrom("shelf")
      .where("uuid", "=", uuid)
      .where("userId", "=", userId)
      .execute()
  })
}

export async function addBooksToShelf(
  shelfUuid: UUID,
  userId: UUID,
  bookUuids: UUID[],
) {
  const existing = await db
    .selectFrom("shelfBook")
    .select(["bookUuid"])
    .where("shelfUuid", "=", shelfUuid)
    .execute()

  const existingSet = new Set(existing.map((e) => e.bookUuid))
  const toAdd = bookUuids.filter((uuid) => !existingSet.has(uuid))

  if (toAdd.length === 0) return

  const maxPosition = await db
    .selectFrom("shelfBook")
    .select((eb) => eb.fn.max("position").as("maxPos"))
    .where("shelfUuid", "=", shelfUuid)
    .executeTakeFirst()

  const startPosition = (maxPosition?.maxPos ?? -1) + 1

  await db
    .insertInto("shelfBook")
    .values(
      toAdd.map((bookUuid, index) => ({
        shelfUuid,
        bookUuid,
        position: startPosition + index,
      })),
    )
    .execute()
}

export async function removeBooksFromShelf(
  shelfUuid: UUID,
  userId: UUID,
  bookUuids: UUID[],
) {
  await db
    .deleteFrom("shelfBook")
    .where("shelfUuid", "=", shelfUuid)
    .where("bookUuid", "in", bookUuids)
    .execute()
}

// ---------------------------------------------------------------------------
// home section management
// ---------------------------------------------------------------------------

export type HomeSectionInput = {
  shelfUuid?: UUID | null
  kind: HomeSectionKind
  enabled?: boolean
  config?: unknown
}

function parseConfig(config: string | null): unknown {
  if (!config) return null
  try {
    return JSON.parse(config)
  } catch {
    return null
  }
}

export async function getHomeSections(userId: UUID) {
  const sections = await db
    .selectFrom("homeSection")
    .leftJoin("shelf", "shelf.uuid", "homeSection.shelfUuid")
    .select([
      "homeSection.uuid",
      "homeSection.shelfUuid",
      "homeSection.kind",
      "homeSection.enabled",
      "homeSection.config",
      "homeSection.position",
      "homeSection.createdAt",
      "homeSection.updatedAt",
      "shelf.name as shelfName",
      "shelf.description as shelfDescription",
      "shelf.filter as shelfFilter",
    ])
    .where("homeSection.userId", "=", userId)
    .orderBy("homeSection.position", "asc")
    .execute()

  return sections.map((hs) => ({
    uuid: hs.uuid,
    shelfUuid: hs.shelfUuid,
    kind: hs.kind as HomeSectionKind,
    enabled: hs.enabled !== 0,
    config: parseConfig(hs.config),
    position: hs.position,
    createdAt: hs.createdAt,
    updatedAt: hs.updatedAt,
    name: hs.shelfName,
    description: hs.shelfDescription,
    filter: hs.shelfFilter ? parseFilter(hs.shelfFilter) : null,
  }))
}

export async function setHomeSections(
  userId: UUID,
  sections: HomeSectionInput[],
) {
  await db.transaction().execute(async (tr) => {
    await tr.deleteFrom("homeSection").where("userId", "=", userId).execute()

    if (sections.length === 0) return

    await tr
      .insertInto("homeSection")
      .values(
        sections.map((section, index) => ({
          userId,
          shelfUuid: section.shelfUuid ?? null,
          kind: section.kind,
          enabled: section.enabled === false ? 0 : 1,
          config:
            section.config != null ? JSON.stringify(section.config) : null,
          position: index,
        })),
      )
      .execute()
  })
}

export async function addHomeSection(userId: UUID, section: HomeSectionInput) {
  const maxPosition = await db
    .selectFrom("homeSection")
    .select((eb) => eb.fn.max("position").as("maxPos"))
    .where("userId", "=", userId)
    .executeTakeFirst()

  const position = (maxPosition?.maxPos ?? -1) + 1

  const { uuid } = await db
    .insertInto("homeSection")
    .values({
      userId,
      shelfUuid: section.shelfUuid ?? null,
      kind: section.kind,
      enabled: section.enabled === false ? 0 : 1,
      config: section.config != null ? JSON.stringify(section.config) : null,
      position,
    })
    .returning(["uuid"])
    .executeTakeFirstOrThrow()

  return uuid
}

export async function removeHomeSection(uuid: UUID, userId: UUID) {
  await db
    .deleteFrom("homeSection")
    .where("uuid", "=", uuid)
    .where("userId", "=", userId)
    .execute()
}

export async function reorderHomeSections(userId: UUID, uuids: UUID[]) {
  await db.transaction().execute(async (tr) => {
    for (let i = 0; i < uuids.length; i++) {
      await tr
        .updateTable("homeSection")
        .set({ position: i })
        .where("uuid", "=", uuids[i]!)
        .where("userId", "=", userId)
        .execute()
    }
  })
}

export async function initializeDefaultHomeSections(userId: UUID) {
  const existing = await db
    .selectFrom("homeSection")
    .select(["uuid"])
    .where("userId", "=", userId)
    .executeTakeFirst()

  if (existing) return

  await setHomeSections(userId, [
    { kind: "hero" },
    { kind: "stats" },
    { kind: "currentlyReading" },
    { kind: "recentlyAdded" },
  ])
}

// ---------------------------------------------------------------------------
// shelf books query
// ---------------------------------------------------------------------------

export type GetShelfBooksOptions = {
  limit?: number
  offset?: number
  orderBy?: ShelfOrderBy
  orderDirection?: "asc" | "desc"
}

export async function getShelfBooks(
  shelfUuid: UUID,
  userId: UUID,
  opts?: GetShelfBooksOptions,
): Promise<BookWithRelations[]> {
  const shelf = await getShelf(shelfUuid, userId)
  const filter = shelf.filter

  const manualBookUuids = shelf.books.map(
    (b: { bookUuid: string }) => b.bookUuid,
  )

  const hasManualBooks = manualBookUuids.length > 0
  const hasFilter = filter !== null

  if (!hasManualBooks && !hasFilter) {
    return []
  }

  let query = booksQuery(userId)

  if (hasFilter && hasManualBooks) {
    query = query.where((eb) =>
      eb.or([
        eb("book.uuid", "in", manualBookUuids),
        buildFilterExpression(eb, filter, userId),
      ]),
    )
  } else if (hasFilter) {
    query = query.where((eb) => buildFilterExpression(eb, filter, userId))
  } else if (hasManualBooks) {
    query = query.where("book.uuid", "in", manualBookUuids)
  }

  const shelfLimit = (shelf as { limitCount?: number | null }).limitCount
  const effectiveLimit = opts?.limit ?? shelfLimit

  if (effectiveLimit) {
    query = query.limit(effectiveLimit)
  }

  if (opts?.offset) {
    query = query.offset(opts.offset)
  }

  const shelfOrderBy = (shelf as { orderBy?: string | null })
    .orderBy as ShelfOrderBy | null
  const shelfOrderDirection = (shelf as { orderDirection?: string | null })
    .orderDirection as "asc" | "desc" | null

  const orderBy = opts?.orderBy ?? shelfOrderBy ?? "createdAt"
  const orderDirection = opts?.orderDirection ?? shelfOrderDirection ?? "desc"

  if (orderBy === "position" && hasManualBooks) {
    query = query.orderBy(
      (eb) =>
        eb
          .case()
          .when("book.uuid", "in", manualBookUuids)
          .then(0)
          .else(1)
          .end(),
      "asc",
    )
  }

  const dbOrderBy = orderBy === "position" ? "createdAt" : orderBy
  query = query.orderBy(`book.${dbOrderBy}`, orderDirection)

  return await query.execute()
}
