import { type Selectable, type Updateable, sql } from "kysely"

import { BookEvents } from "@/events"
import type { UUID } from "@/uuid"

import { getBooks } from "./books"
import { type ListOptions } from "./collections"
import { db } from "./connection"
import type { DB } from "./schema"
import { cleanShelfFiltersForDeletedEntity } from "./shelfFilter"

export type TagUpdate = Updateable<DB["tag"]>

export type Tag = Selectable<DB["tag"]>

export async function getTags(
  userId?: UUID,
  { order = "asc", limit }: ListOptions = {},
) {
  const query = db
    .selectFrom("tag")
    .$if(!!userId, (qb) =>
      qb
        .innerJoin("bookToTag", "bookToTag.tagUuid", "tag.uuid")
        .leftJoin(
          "bookToCollection",
          "bookToTag.bookUuid",
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
    .groupBy("tag.uuid")
    .selectAll("tag")
    .orderBy(sql`tag.name collate nocase`, order)

  return await (limit !== undefined ? query.limit(limit) : query).execute()
}

export async function getTagByUuid(tagUuid: UUID, userId?: UUID) {
  return db
    .selectFrom("tag")
    .where("tag.uuid", "=", tagUuid)
    .$if(!!userId, (qb) =>
      qb
        .innerJoin("bookToTag", "bookToTag.tagUuid", "tag.uuid")
        .leftJoin(
          "bookToCollection",
          "bookToTag.bookUuid",
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
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            eb("collectionToUser.userId", "=", userId!),
            eb("collection.public", "=", true),
            eb("collection.public", "is", null),
          ]),
        ),
    )
    .groupBy("tag.uuid")
    .selectAll("tag")
    .executeTakeFirst()
}

// find-or-create by name so a standalone create can't produce duplicate tags.
// books are attached separately via addTagsToBooks.
export async function createTag(values: {
  name: string
  icon?: string | null
  color?: string | null
}) {
  const existing = await db
    .selectFrom("tag")
    .selectAll()
    .where("name", "=", values.name)
    .executeTakeFirst()

  if (existing) return existing

  return await db
    .insertInto("tag")
    .values(values)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function addTagsToBooks(bookUuids: UUID[], tagNames: string[]) {
  await db.transaction().execute(async (tr) => {
    const existingTags = await tr
      .selectFrom("tag")
      .select(["uuid", "name"])
      .where("name", "in", tagNames)
      .execute()

    const newTagNames = tagNames.filter(
      (tagName) => !existingTags.some((tag) => tag.name === tagName),
    )

    let newTags: { uuid: UUID; name: string }[] = []
    if (newTagNames.length) {
      newTags = await tr
        .insertInto("tag")
        .values(newTagNames.map((tagName) => ({ name: tagName })))
        .returning(["uuid as uuid", "name as name"])
        .execute()
    }

    let existingBookToTags: {
      tagUuid: UUID
      bookUuid: UUID
    }[] = []
    if (existingTags.length) {
      existingBookToTags = await tr
        .selectFrom("bookToTag")
        .select(["bookToTag.bookUuid", "bookToTag.tagUuid"])
        .where("bookUuid", "in", bookUuids)
        .where(
          "tagUuid",
          "in",
          existingTags.map((tag) => tag.uuid),
        )
        .execute()
    }

    const newBookToTags = existingTags
      .flatMap(({ uuid: tagUuid }) =>
        bookUuids.map((bookUuid) => ({ tagUuid, bookUuid })),
      )
      .filter(({ tagUuid, bookUuid }) =>
        existingBookToTags.every(
          (bookToTag) =>
            tagUuid !== bookToTag.tagUuid || bookUuid !== bookToTag.bookUuid,
        ),
      )

    const bookToTags = newBookToTags.concat(
      newTags.flatMap(({ uuid: tagUuid }) =>
        bookUuids.map((bookUuid) => ({ tagUuid, bookUuid })),
      ),
    )

    if (bookToTags.length) {
      await tr.insertInto("bookToTag").values(bookToTags).execute()
    }
  })

  const tags = await getTags()
  const books = await getBooks(bookUuids)

  books.forEach((book) => {
    BookEvents.emit("message", {
      type: "bookUpdated",
      bookUuid: book.uuid,
      payload: {
        tags: [
          ...book.tags,
          ...tagNames
            .map((tagName) => tags.find((t) => t.name === tagName))
            .filter((t) => !!t),
        ],
      },
    })
  })
}

export async function removeTagsFromBooks(bookUuids: UUID[], tagUuids: UUID[]) {
  await db.transaction().execute(async (tr) => {
    await tr
      .deleteFrom("bookToTag")
      .where("bookUuid", "in", bookUuids)
      .where("tagUuid", "in", tagUuids)
      .execute()

    await tr
      .deleteFrom("tag")
      .where("tag.uuid", "not in", (eb) =>
        eb.selectFrom("bookToTag").select(["bookToTag.tagUuid"]),
      )
      .execute()
  })

  const books = await getBooks(bookUuids)

  books.forEach((book) => {
    BookEvents.emit("message", {
      type: "bookUpdated",
      bookUuid: book.uuid,
      payload: {
        tags: book.tags.filter((t) => !tagUuids.includes(t.uuid)),
      },
    })
  })
}

export async function updateTag(uuid: UUID, update: TagUpdate) {
  await db.updateTable("tag").set(update).where("uuid", "=", uuid).execute()

  return await db
    .selectFrom("tag")
    .selectAll()
    .where("uuid", "=", uuid)
    .executeTakeFirstOrThrow()
}

export async function deleteTag(uuid: UUID) {
  const affectedBookUuids = await db.transaction().execute(async (tr) => {
    const rows = await tr
      .selectFrom("bookToTag")
      .select(["bookUuid"])
      .where("tagUuid", "=", uuid)
      .execute()

    await tr.deleteFrom("bookToTag").where("tagUuid", "=", uuid).execute()
    await tr.deleteFrom("tag").where("uuid", "=", uuid).execute()

    return rows.map((r) => r.bookUuid)
  })

  await cleanShelfFiltersForDeletedEntity("tag", uuid)

  if (affectedBookUuids.length > 0) {
    const books = await getBooks(affectedBookUuids)

    books.forEach((book) => {
      BookEvents.emit("message", {
        type: "bookUpdated",
        bookUuid: book.uuid,
        payload: { tags: book.tags },
      })
    })
  }
}

export async function mergeTags(targetUuid: UUID, sourceUuids: UUID[]) {
  const affectedBookUuids = await db.transaction().execute(async (tr) => {
    // find books already linked to the target so we can skip duplicates
    const existingLinks = await tr
      .selectFrom("bookToTag")
      .select(["bookUuid"])
      .where("tagUuid", "=", targetUuid)
      .execute()

    const existingSet = new Set(existingLinks.map((r) => r.bookUuid))

    // find books linked to source tags
    const sourceLinks = await tr
      .selectFrom("bookToTag")
      .select(["bookUuid"])
      .where("tagUuid", "in", sourceUuids)
      .execute()

    const toInsert = sourceLinks
      .filter((r) => !existingSet.has(r.bookUuid))
      .map((r) => r.bookUuid)

    // deduplicate within the toInsert set
    const uniqueToInsert = [...new Set(toInsert)]

    if (uniqueToInsert.length > 0) {
      await tr
        .insertInto("bookToTag")
        .values(
          uniqueToInsert.map((bookUuid) => ({
            bookUuid,
            tagUuid: targetUuid,
          })),
        )
        .execute()
    }

    await tr
      .deleteFrom("bookToTag")
      .where("tagUuid", "in", sourceUuids)
      .execute()

    await tr.deleteFrom("tag").where("uuid", "in", sourceUuids).execute()

    return [
      ...new Set([
        ...existingLinks.map((r) => r.bookUuid),
        ...sourceLinks.map((r) => r.bookUuid),
      ]),
    ]
  })

  for (const sourceUuid of sourceUuids) {
    await cleanShelfFiltersForDeletedEntity("tag", sourceUuid)
  }

  if (affectedBookUuids.length > 0) {
    const books = await getBooks(affectedBookUuids)

    books.forEach((book) => {
      BookEvents.emit("message", {
        type: "bookUpdated",
        bookUuid: book.uuid,
        payload: { tags: book.tags },
      })
    })
  }
}
