import { type Insertable, type Selectable, type Updateable } from "kysely"
import { jsonArrayFrom } from "kysely/helpers/sqlite"

import { type Role } from "@/components/books/edit/marcRelators"
import { BookEvents } from "@/events"
import { type UUID } from "@/uuid"

import { getBooks } from "./books"
import { db } from "./connection"
import { type DB } from "./schema"
import { cleanShelfFiltersForDeletedEntity } from "./shelfFilter"

export type Creator = Selectable<DB["creator"]>
export type NewCreator = Insertable<DB["creator"]>
export type CreatorUpdate = Updateable<DB["creator"]>

// (
//   select coalesce(json_group_array(json_object(
//     'pet_id', "agg"."pet_id",
//     'name', "agg"."name"
//   )), '[]') from (
//     select "pet"."id" as "pet_id", "pet"."name"
//     from "pet"
//     where "pet"."owner_id" = "person"."id"
//     order by "pet"."name"
//   ) as "agg"
// ) as "pets"

export async function getCreators(
  userId?: UUID,
  role?: Role,
): Promise<(Creator & { roles?: Role[] })[]> {
  return db
    .selectFrom("creator")
    .$if(!role, (qb) =>
      qb
        .innerJoin(
          "bookToCreator as bookToCreatorAgg",
          "bookToCreatorAgg.creatorUuid",
          "creator.uuid",
        )
        .select((eb) =>
          eb.fn("json_group_array", ["bookToCreatorAgg.role"]).as("roles"),
        )
        .whereRef("bookToCreatorAgg.creatorUuid", "=", "creator.uuid"),
    )
    .$if(!!role, (qb) =>
      qb
        .innerJoin(
          "bookToCreator as roleCheck",
          "roleCheck.creatorUuid",
          "creator.uuid",
        )
        // The $if condition ensures that this only runs when role
        // is not null
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        .where("roleCheck.role", "=", role!),
    )
    .$if(!!userId, (qb) =>
      qb
        .innerJoin("bookToCreator", "bookToCreator.creatorUuid", "creator.uuid")
        .leftJoin(
          "bookToCollection",
          "bookToCreator.bookUuid",
          "bookToCollection.bookUuid",
        )
        .leftJoin(
          "collection",
          "collection.uuid",
          "bookToCollection.collectionUuid",
        )
        .leftJoin(
          "collectionToUser",
          "collectionToUser.collectionUuid",
          "bookToCollection.collectionUuid",
        )
        .where((eb) =>
          eb.or([
            // The $if condition ensures that this only runs when userId
            // is not null
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            eb("collectionToUser.userId", "=", userId!),
            eb("collection.public", "=", true),
            eb("collection.public", "is", null),
          ]),
        ),
    )
    .groupBy("creator.uuid")
    .selectAll("creator")
    .execute()
}

export async function updateCreator(uuid: UUID, update: CreatorUpdate) {
  await db.updateTable("creator").set(update).where("uuid", "=", uuid).execute()

  return await db
    .selectFrom("creator")
    .selectAll()
    .where("uuid", "=", uuid)
    .executeTakeFirstOrThrow()
}

export async function deleteCreator(uuid: UUID) {
  const affectedBookUuids = await db.transaction().execute(async (tr) => {
    const rows = await tr
      .selectFrom("bookToCreator")
      .select(["bookUuid"])
      .where("creatorUuid", "=", uuid)
      .execute()

    await tr
      .deleteFrom("bookToCreator")
      .where("creatorUuid", "=", uuid)
      .execute()

    await tr.deleteFrom("creator").where("uuid", "=", uuid).execute()

    return rows.map((r) => r.bookUuid)
  })

  await cleanShelfFiltersForDeletedEntity("creator", uuid)

  if (affectedBookUuids.length > 0) {
    const books = await getBooks(affectedBookUuids)

    books.forEach((book) => {
      BookEvents.emit("message", {
        type: "bookUpdated",
        bookUuid: book.uuid,
        payload: {
          authors: book.authors,
          narrators: book.narrators,
          creators: book.creators,
        },
      })
    })
  }
}

export async function mergeCreators(targetUuid: UUID, sourceUuids: UUID[]) {
  const affectedBookUuids = await db.transaction().execute(async (tr) => {
    // find existing links to the target so we skip duplicates per (book, role)
    const existingLinks = await tr
      .selectFrom("bookToCreator")
      .select(["bookUuid", "role"])
      .where("creatorUuid", "=", targetUuid)
      .execute()

    const existingKey = new Set(
      existingLinks.map((r) => `${r.bookUuid}:${r.role}`),
    )

    // find all links from source creators
    const sourceLinks = await tr
      .selectFrom("bookToCreator")
      .select(["bookUuid", "role"])
      .where("creatorUuid", "in", sourceUuids)
      .execute()

    const toInsert = sourceLinks.filter(
      (r) => !existingKey.has(`${r.bookUuid}:${r.role}`),
    )

    // deduplicate
    const seen = new Set<string>()
    const uniqueToInsert = toInsert.filter((r) => {
      const key = `${r.bookUuid}:${r.role}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    if (uniqueToInsert.length > 0) {
      await tr
        .insertInto("bookToCreator")
        .values(
          uniqueToInsert.map((r) => ({
            bookUuid: r.bookUuid,
            creatorUuid: targetUuid,
            role: r.role,
          })),
        )
        .execute()
    }

    await tr
      .deleteFrom("bookToCreator")
      .where("creatorUuid", "in", sourceUuids)
      .execute()

    await tr.deleteFrom("creator").where("uuid", "in", sourceUuids).execute()

    return [
      ...new Set([
        ...existingLinks.map((r) => r.bookUuid),
        ...sourceLinks.map((r) => r.bookUuid),
      ]),
    ]
  })

  for (const sourceUuid of sourceUuids) {
    await cleanShelfFiltersForDeletedEntity("creator", sourceUuid)
  }

  if (affectedBookUuids.length > 0) {
    const books = await getBooks(affectedBookUuids)

    books.forEach((book) => {
      BookEvents.emit("message", {
        type: "bookUpdated",
        bookUuid: book.uuid,
        payload: {
          authors: book.authors,
          narrators: book.narrators,
          creators: book.creators,
        },
      })
    })
  }
}
