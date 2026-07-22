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
    bookCount: row.bookCount,
  }))
}

/**
 * The existing creator whose name is the same person as `name` under spelling
 * normalization ("J.K. Rowling" finds "J. K. Rowling"), so a repair reuses
 * the library's canonical spelling instead of re-creating a variant the
 * cluster merge just eliminated. Exact matches win; returns the input name
 * when nobody matches.
 */
export async function resolveCanonicalCreatorName(
  name: string,
): Promise<{ name: string; fileAs: string | null }> {
  const exact = await db
    .selectFrom("creator")
    .select(["name", "fileAs"])
    .where("name", "=", name)
    .executeTakeFirst()
  if (exact) return exact
  const key = name.toLowerCase().replace(/[^a-z]/g, "")
  if (!key) return { name, fileAs: null }
  const rows = await db
    .selectFrom("creator")
    .select(["name", "fileAs"])
    .execute()
  const match = rows.find(
    (row) => row.name.toLowerCase().replace(/[^a-z]/g, "") === key,
  )
  return match ?? { name, fileAs: null }
}

/**
 * Every name credited anywhere in the library as a narrator, lowercased.
 * A proposed AUTHOR matching one of these is most likely a narration credit
 * that lost its prefix; writing it as the author is how narrators ended up
 * crowned on real books.
 */
export async function getNarratorNames(): Promise<Set<string>> {
  const rows = await db
    .selectFrom("creator")
    .innerJoin("bookToCreator", "bookToCreator.creatorUuid", "creator.uuid")
    .where("bookToCreator.role", "=", "nrt")
    // Someone credited as an author anywhere narrates their own books;
    // never treat them as narrator-only.
    .where("creator.uuid", "not in", (eb) =>
      eb
        .selectFrom("bookToCreator")
        .select("bookToCreator.creatorUuid")
        .where("bookToCreator.role", "=", "aut"),
    )
    .select("creator.name")
    .distinct()
    .execute()
  return new Set(rows.map((row) => row.name.toLowerCase()))
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
