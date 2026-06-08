import type { Insertable, Selectable, Updateable } from "kysely"

import { BookEvents } from "@/events"
import type { UUID } from "@/uuid"

import { type NewBookToSeries, getBooks } from "./books"
import { db } from "./connection"
import type { BookToSeries, DB } from "./schema"
import { cleanShelfFiltersForDeletedEntity } from "./shelfFilter"

export type Series = Selectable<DB["series"]>
export type NewSeries = Insertable<DB["series"]>
export type SeriesUpdate = Updateable<DB["series"]>

export type NewSeriesRelation = Omit<NewBookToSeries, "seriesUuid">

export function seriesQuery(userId?: UUID) {
  return db
    .selectFrom("series")
    .$if(!!userId, (qb) =>
      qb
        .innerJoin("bookToSeries", "bookToSeries.seriesUuid", "series.uuid")
        .leftJoin(
          "bookToCollection",
          "bookToSeries.bookUuid",
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
    .groupBy("series.uuid")
    .selectAll("series")
}

export function getSeriesByUuid(seriesUuid: UUID, userId?: UUID) {
  return seriesQuery(userId)
    .where("series.uuid", "=", seriesUuid)
    .executeTakeFirst()
}

export async function getSeries(userId?: UUID) {
  return await seriesQuery(userId).execute()
}

export async function addBooksToSeries(
  series: NewSeries,
  relations: NewSeriesRelation[],
) {
  await db.transaction().execute(async (tr) => {
    let existing = await tr
      .selectFrom("series")
      .select(["uuid"])
      .where("name", "=", series.name)
      .executeTakeFirst()

    if (!existing) {
      existing = await tr
        .insertInto("series")
        .values(series)
        .returning(["uuid as uuid"])
        .executeTakeFirstOrThrow()
    }

    const withNewFeatured = relations.filter(
      (relation) => relation.featured && relation.uuid,
    )

    if (withNewFeatured[0]?.featured) {
      await tr
        .updateTable("bookToSeries")
        .set({ featured: false })
        .where(
          "bookToSeries.bookUuid",
          "in",
          // uuid is filtered for above
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          withNewFeatured.map(({ uuid }) => uuid!),
        )
        .execute()
    }

    await tr
      .insertInto("bookToSeries")
      .values(
        relations.map((relation) => ({
          bookUuid: relation.bookUuid,
          seriesUuid: existing.uuid,
          position: relation.position,
          featured: relation.featured,
        })),
      )
      .execute()
  })

  const books = await getBooks(relations.map((relation) => relation.bookUuid))

  books.forEach((book) => {
    BookEvents.emit("message", {
      type: "bookUpdated",
      bookUuid: book.uuid,
      payload: {
        series: book.series,
      },
    })
  })
}

export async function removeBooksFromSeries(
  seriesUuids: UUID[],
  bookUuids: UUID[],
) {
  await db.transaction().execute(async (tr) => {
    await tr
      .deleteFrom("bookToSeries")
      .where("bookUuid", "in", bookUuids)
      .where("seriesUuid", "in", seriesUuids)
      .execute()

    await tr
      .deleteFrom("series")
      .where("series.uuid", "not in", (eb) =>
        eb.selectFrom("bookToSeries").select(["bookToSeries.seriesUuid"]),
      )
      .execute()
  })

  const books = await getBooks(bookUuids)

  books.forEach((book) => {
    BookEvents.emit("message", {
      type: "bookUpdated",
      bookUuid: book.uuid,
      payload: {
        series: book.series,
      },
    })
  })
}

export async function updateSeries(
  uuid: UUID,
  update: SeriesUpdate,
  relations: { books?: NewSeriesRelation[] },
) {
  const affectedBooks = await db.transaction().execute(async (tr) => {
    if (Object.keys(update).length) {
      await tr
        .updateTable("series")
        .set(update)
        .where("uuid", "=", uuid)
        .execute()
    }

    let insertedBooks: Pick<BookToSeries, "bookUuid">[] = []
    const deletedSeries = await tr
      .deleteFrom("bookToSeries")
      .where("seriesUuid", "=", uuid)
      .returning(["bookToSeries.bookUuid"])
      .execute()

    if (relations.books) {
      insertedBooks = await tr
        .insertInto("bookToSeries")
        .values(
          relations.books.map((relation) => ({
            ...relation,
            seriesUuid: uuid,
          })),
        )
        .returning(["bookToSeries.bookUuid"])
        .execute()
    }

    return new Set([
      ...deletedSeries.map((b) => b.bookUuid),
      ...insertedBooks.map((b) => b.bookUuid),
    ])
  })

  if (affectedBooks.size) {
    const books = await getBooks(Array.from(affectedBooks))

    books.forEach((book) => {
      BookEvents.emit("message", {
        type: "bookUpdated",
        bookUuid: book.uuid,
        payload: {
          series: book.series,
        },
      })
    })
  }

  return await db
    .selectFrom("series")
    .selectAll()
    .where("uuid", "=", uuid)
    .executeTakeFirstOrThrow()
}

export async function deleteSeries(uuid: UUID) {
  const bookUuids = await db.transaction().execute(async (tr) => {
    const bookUuids = await tr
      .selectFrom("bookToSeries")
      .select(["bookUuid"])
      .where("seriesUuid", "=", uuid)
      .execute()
    await tr.deleteFrom("bookToSeries").where("seriesUuid", "=", uuid).execute()

    await tr.deleteFrom("series").where("uuid", "=", uuid).execute()
    return bookUuids
  })

  await cleanShelfFiltersForDeletedEntity("series", uuid)

  const books = await getBooks(bookUuids.map((book) => book.bookUuid))

  books.forEach((book) => {
    BookEvents.emit("message", {
      type: "bookUpdated",
      bookUuid: book.uuid,
      payload: {
        series: book.series,
      },
    })
  })
}

export async function mergeSeries(targetUuid: UUID, sourceUuids: UUID[]) {
  const affectedBookUuids = await db.transaction().execute(async (tr) => {
    const existingLinks = await tr
      .selectFrom("bookToSeries")
      .select(["bookUuid"])
      .where("seriesUuid", "=", targetUuid)
      .execute()

    const existingSet = new Set(existingLinks.map((r) => r.bookUuid))

    const sourceLinks = await tr
      .selectFrom("bookToSeries")
      .select(["bookUuid", "position", "featured"])
      .where("seriesUuid", "in", sourceUuids)
      .execute()

    const toInsert = sourceLinks.filter((r) => !existingSet.has(r.bookUuid))

    // deduplicate by bookUuid, keep first occurrence
    const seen = new Set<string>()
    const uniqueToInsert = toInsert.filter((r) => {
      if (seen.has(r.bookUuid)) return false
      seen.add(r.bookUuid)
      return true
    })

    if (uniqueToInsert.length > 0) {
      await tr
        .insertInto("bookToSeries")
        .values(
          uniqueToInsert.map((r) => ({
            bookUuid: r.bookUuid,
            seriesUuid: targetUuid,
            position: r.position,
            featured: r.featured,
          })),
        )
        .execute()
    }

    await tr
      .deleteFrom("bookToSeries")
      .where("seriesUuid", "in", sourceUuids)
      .execute()

    await tr.deleteFrom("series").where("uuid", "in", sourceUuids).execute()

    return [
      ...new Set([
        ...existingLinks.map((r) => r.bookUuid),
        ...sourceLinks.map((r) => r.bookUuid),
      ]),
    ]
  })

  for (const sourceUuid of sourceUuids) {
    await cleanShelfFiltersForDeletedEntity("series", sourceUuid)
  }

  if (affectedBookUuids.length > 0) {
    const books = await getBooks(affectedBookUuids)

    books.forEach((book) => {
      BookEvents.emit("message", {
        type: "bookUpdated",
        bookUuid: book.uuid,
        payload: { series: book.series },
      })
    })
  }
}
