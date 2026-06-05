import { sql } from "kysely"

import { type UUID } from "@/uuid"

import { db } from "./connection"

export type HomeStats = {
  inProgress: number
  finishedThisYear: number
  inLibrary: number
  tags: number
  authors: number
}

async function countByStatusName(userId: UUID, statusName: string) {
  const row = await db
    .selectFrom("bookToStatus")
    .innerJoin("status", "status.uuid", "bookToStatus.statusUuid")
    .where("bookToStatus.userId", "=", userId)
    .where("status.name", "=", statusName)
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .executeTakeFirst()

  return row?.count ?? 0
}

export async function getHomeStats(userId: UUID): Promise<HomeStats> {
  const inProgress = await countByStatusName(userId, "Reading")

  // approximate: no explicit finished-at, so use the last status-change date
  const year = new Date().getFullYear().toString()
  const finishedRow = await db
    .selectFrom("bookToStatus")
    .innerJoin("status", "status.uuid", "bookToStatus.statusUuid")
    .where("bookToStatus.userId", "=", userId)
    .where("status.name", "=", "Read")
    .where(sql<boolean>`strftime('%Y', book_to_status.updated_at) = ${year}`)
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .executeTakeFirst()

  const inLibraryRow = await db
    .selectFrom("book")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .executeTakeFirst()

  const tagsRow = await db
    .selectFrom("tag")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .executeTakeFirst()

  const authorsRow = await db
    .selectFrom("bookToCreator")
    .where("role", "=", "aut")
    .select((eb) =>
      eb.fn.count<number>("creatorUuid").distinct().as("count"),
    )
    .executeTakeFirst()

  return {
    inProgress,
    finishedThisYear: finishedRow?.count ?? 0,
    inLibrary: inLibraryRow?.count ?? 0,
    tags: tagsRow?.count ?? 0,
    authors: authorsRow?.count ?? 0,
  }
}
