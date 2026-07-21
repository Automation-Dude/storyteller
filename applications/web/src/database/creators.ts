import { type Insertable, type Selectable, type Updateable } from "kysely"

import { type Role } from "@/components/books/edit/marcRelators"
import { type UUID } from "@/uuid"

import { db } from "./connection"
import { type DB } from "./schema"

export type Creator = Selectable<DB["creator"]>
export type NewCreator = Insertable<DB["creator"]>
export type CreatorUpdate = Updateable<DB["creator"]>

export async function getCreators(userId?: UUID, role?: Role) {
  return db
    .selectFrom("creator")
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

/**
 * Every author-role creator with how many books it carries, for the
 * creator-level repair that clusters near-identical spellings.
 */
export async function getAuthorCreatorsWithCounts() {
  const rows = await db
    .selectFrom("creator")
    .innerJoin("bookToCreator", "bookToCreator.creatorUuid", "creator.uuid")
    .where("bookToCreator.role", "=", "aut")
    .select(({ fn }) => [
      "creator.uuid",
      "creator.name",
      fn.count<number>("bookToCreator.bookUuid").as("bookCount"),
    ])
    .groupBy(["creator.uuid", "creator.name"])
    .execute()
  return rows.map((row) => ({
    uuid: row.uuid,
    name: row.name,
    bookCount: Number(row.bookCount),
  }))
}

/** The books credited to any of the given creators as author. */
export async function getBookUuidsByCreators(
  creatorUuids: UUID[],
  limit: number,
): Promise<UUID[]> {
  if (creatorUuids.length === 0) return []
  const rows = await db
    .selectFrom("bookToCreator")
    .where("bookToCreator.role", "=", "aut")
    .where("bookToCreator.creatorUuid", "in", creatorUuids)
    .select("bookToCreator.bookUuid")
    .distinct()
    .limit(limit)
    .execute()
  return rows.map((row) => row.bookUuid)
}
