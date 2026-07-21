import { type UUID } from "@/uuid"

import { type BookWithRelations, getBooks } from "./books"
import { db } from "./connection"
import { STATUS_READ, STATUS_READING, STATUS_TO_READ } from "./statusKinds"

/**
 * one book per series the user has read into: the lowest-position book above
 * their highest READ position that is still to-be-read (no status, or
 * "To read"). series are ordered by the user's most recent reading activity
 * in them.
 */
export async function getNextUpInSeries(
  userId: UUID,
  limit = 20,
): Promise<BookWithRelations[]> {
  // const r1 = await db
  //   .with("readPos", (db) =>
  //     db
  //       .selectFrom("bookToSeries")
  //       .innerJoin(
  //         "bookToStatus",
  //         "bookToStatus.bookUuid",
  //         "bookToSeries.bookUuid",
  //       )
  //       .innerJoin("status", "status.uuid", "bookToStatus.statusUuid")
  //       .select((eb) => [
  //         "bookToSeries.seriesUuid",
  //         eb.fn.max("bookToSeries.position").as("maxRead"),
  //         eb.fn.max("bookToStatus.updatedAt").as("lastReadAt"),
  //       ])
  //       .where("status.name", "in", [STATUS_READ, STATUS_TO_READ])
  //       .where("bookToSeries.position", "is not", null)
  //       .groupBy("bookToSeries.seriesUuid"),
  //   )
  //   .with("candidates", (db) =>
  //     db
  //       .selectFrom("bookToSeries")
  //       .innerJoin("readPos", "readPos.seriesUuid", "bookToSeries.seriesUuid")
  //       .select((eb) => [
  //         "bookToSeries.seriesUuid",
  //         "bookToSeries.bookUuid",
  //         "bookToSeries.position",
  //         "readPos.maxRead",
  //         "readPos.lastReadAt",
  //         eb.fn
  //           .agg("row_number")
  //           .over((ob) =>
  //             ob
  //               .partitionBy("bookToSeries.seriesUuid")
  //               .orderBy("bookToSeries.position", "asc"),
  //           )
  //           .as("rn"),
  //       ])
  //       .where((eb) =>
  //         eb.not(
  //           eb.exists((qb) =>
  //             qb
  //               .selectFrom("bookToStatus")
  //               .select(sql<number>`1`.as("read"))
  //               .innerJoin("status", "status.uuid", "bookToStatus.statusUuid")
  //               .whereRef("bookToStatus.bookUuid", "=", "bookToSeries.bookUuid")
  //               .where("bookToStatus.userId", "=", userId)
  //               .where("status.name", "!=", STATUS_TO_READ),
  //           ),
  //         ),
  //       )
  //       .orderBy("bookToSeries.position", "asc")
  //       .groupBy("bookToSeries.seriesUuid"),
  //   )
  //   .selectFrom("candidates")
  //   .select([
  //     "candidates.bookUuid",
  //     "candidates.rn",
  //     "candidates.maxRead",
  //     "candidates.lastReadAt",
  //     "candidates.position",
  //   ])
  //   .innerJoin("readPos", "readPos.seriesUuid", "candidates.seriesUuid")
  //   .orderBy("readPos.lastReadAt", "desc")
  //   .orderBy(
  //     (eb) =>
  //       eb
  //         .selectFrom("position")
  //         .select((eb) => eb.fn.max("position.timestamp").as("maxTimestamp"))
  //         .innerJoin(
  //           "bookToSeries",
  //           "bookToSeries.bookUuid",
  //           "candidates.bookUuid",
  //         )
  //         .whereRef("bookToSeries.seriesUuid", "=", "candidates.seriesUuid")
  //         .where("position.userId", "=", userId),
  //     (ob) => ob.desc().nullsLast(),
  //   )
  //   .where("candidates.rn", "=", 1)

  //   .limit(limit)
  //   .execute()
  // console.log("rrrrrrrrrrrr", r1)

  const r = await db
    // all series the user is reading
    // technically also those that are completed
    // but will get filtered out by the next query
    .with("readingSeries", (db) =>
      db
        .selectFrom("series")
        .select("series.uuid")
        .innerJoin("bookToSeries", "bookToSeries.seriesUuid", "series.uuid")
        .innerJoin(
          "bookToStatus",
          "bookToStatus.bookUuid",
          "bookToSeries.bookUuid",
        )
        .innerJoin("status", "status.uuid", "bookToStatus.statusUuid")
        .selectAll("bookToSeries")
        .where("bookToStatus.userId", "=", userId)
        .where("status.name", "in", [STATUS_READ, STATUS_READING]),
    )
    .with("candidates", (db) =>
      db
        .selectFrom("bookToSeries")
        .innerJoin(
          "bookToStatus",
          "bookToStatus.bookUuid",
          "bookToSeries.bookUuid",
        )
        .select((eb) => [
          "bookToSeries.bookUuid",
          eb.fn
            .agg("row_number")
            .over((ob) =>
              ob
                .partitionBy("bookToSeries.seriesUuid")
                .orderBy("bookToSeries.position", "asc"),
            )
            .as("rn"),
        ])
        .innerJoin("status", "status.uuid", "bookToStatus.statusUuid")
        .where("bookToStatus.userId", "=", userId)
        .where("status.name", "=", STATUS_TO_READ)
        .where("bookToSeries.seriesUuid", "in", (eb) =>
          eb.selectFrom("readingSeries").select("seriesUuid"),
        )
        .orderBy("bookToSeries.position", "asc"),
    )
    .selectFrom("candidates")
    .select(["candidates.bookUuid"])
    .orderBy("candidates.rn", "asc")
    .where("candidates.rn", "=", 1)
    .limit(limit)
    .execute()
  // const result = await sql<{ bookUuid: UUID }>`
  //   with read_pos as (
  //     select bts.series_uuid as series_uuid,
  //            max(bts.position) as max_read,
  //            max(bs.updated_at) as last_read_at
  //     from book_to_series bts
  //     inner join book_to_status bs
  //       on bs.book_uuid = bts.book_uuid and bs.user_id = ${userId}
  //     inner join status st on st.uuid = bs.status_uuid
  //     where st.name = ${STATUS_READ} and bts.position is not null
  //     group by bts.series_uuid
  //   ),
  //   candidates as (
  //     select bts.series_uuid as series_uuid,
  //            bts.book_uuid as book_uuid,
  //            row_number() over (
  //              partition by bts.series_uuid order by bts.position asc
  //            ) as rn
  //     from book_to_series bts
  //     inner join read_pos rp on rp.series_uuid = bts.series_uuid
  //     where bts.position > rp.max_read
  //       and not exists (
  //         select 1 from book_to_status bs
  //         inner join status st on st.uuid = bs.status_uuid
  //         where bs.book_uuid = bts.book_uuid
  //           and bs.user_id = ${userId}
  //           and st.name != ${STATUS_TO_READ}
  //       )
  //   )
  //   select c.book_uuid as "bookUuid"
  //   from candidates c
  //   inner join read_pos rp on rp.series_uuid = c.series_uuid
  //   where c.rn = 1
  //   order by
  //     (
  //       select max(p.timestamp)
  //       from position p
  //       inner join book_to_series b2 on b2.book_uuid = p.book_uuid
  //       where b2.series_uuid = c.series_uuid and p.user_id = ${userId}
  //     ) desc nulls last,
  //     rp.last_read_at desc
  //   limit ${limit}
  // `.execute(db)

  // a book can be the next of two series; keep its first (most recent) slot
  const uuids = [...new Set(r.map((r) => r.bookUuid))]
  if (uuids.length === 0) return []

  // hydrate through getBooks so visibility rules and relations apply, then
  // restore the activity order (getBooks does not preserve input order)
  const books = await getBooks(uuids, userId)
  const byUuid = new Map(books.map((b) => [b.uuid, b]))
  return uuids
    .map((uuid) => byUuid.get(uuid))
    .filter((b): b is BookWithRelations => b !== undefined)
}
