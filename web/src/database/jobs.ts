import { type Selectable } from "kysely"

import { JobEvents } from "@/jobEvents"
import type { UUID } from "@/uuid"
import type { RestartMode } from "@/work/distributor"
import {
  type RunConfig,
  type RunConfigSummary,
  summarizeRunConfig,
} from "@/work/runConfig"

import { type Readaloud } from "./books"
import { db } from "./connection"
import { type DB } from "./schema"

export type JobType = "book_align"

export type JobStatus =
  | "QUEUED"
  | "RUNNING"
  | "PAUSED"
  | "DONE"
  | "ERROR"
  | "CANCELED"

export const ACTIVE_JOB_STATUSES = [
  "QUEUED",
  "RUNNING",
  "PAUSED",
] as const satisfies JobStatus[]
export const TERMINAL_JOB_STATUSES = [
  "DONE",
  "ERROR",
  "CANCELED",
] as const satisfies JobStatus[]

type JobRow = Selectable<DB["job"]>

export type Job = Omit<
  JobRow,
  "uuid" | "bookUuid" | "type" | "status" | "restart" | "stage" | "config"
> & {
  uuid: UUID
  bookUuid: UUID | null
  type: JobType
  status: JobStatus
  restart: RestartMode
  stage: Readaloud["currentStage"] | null
  config: RunConfig | null
}

// client-safe job: the full config (with api keys) is replaced by a summary, and
// the subject book's title is joined in for display.
export type PublicJob = Omit<Job, "config"> & {
  config: RunConfigSummary | null
  bookTitle: string | null
}

export function toPublicJob(
  job: Job,
  bookTitle: string | null = null,
): PublicJob {
  return { ...job, config: summarizeRunConfig(job.config), bookTitle }
}

export type NewJob = {
  type: JobType
  bookUuid: UUID | null
  restart: RestartMode
  config: RunConfig | null
  position: number
}

export type JobUpdate = Partial<{
  status: JobStatus
  stage: Readaloud["currentStage"] | null
  progress: number
  error: string | null
  startedAt: string | null
  finishedAt: string | null
  position: number
}>

function parseJob(row: JobRow): Job {
  return {
    ...row,
    uuid: row.uuid,
    bookUuid: (row.bookUuid as UUID | null) ?? null,
    type: row.type as JobType,
    status: row.status as JobStatus,
    restart: (row.restart as RestartMode | null) ?? false,
    stage: row.stage | null,
    config: row.config ? row.config : null,
  }
}

function emit(type: "jobUpdated" | "jobCreated" | "jobDeleted", jobUuid: UUID) {
  JobEvents.emit("message", { type, jobUuid })
}

export async function createJob(job: NewJob): Promise<Job> {
  const row = await db
    .insertInto("job")
    .values({
      type: job.type,
      bookUuid: job.bookUuid,
      restart: job.restart || null,
      config: job.config ? JSON.stringify(job.config) : null,
      position: job.position,
      status: "QUEUED",
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  const parsed = parseJob(row)
  emit("jobCreated", parsed.uuid)
  return parsed
}

export async function getJob(uuid: UUID): Promise<Job | null> {
  const row = await db
    .selectFrom("job")
    .selectAll()
    .where("uuid", "=", uuid)
    .executeTakeFirst()
  return row ? parseJob(row) : null
}

export async function getJobs(filter?: {
  statuses?: readonly JobStatus[]
}): Promise<Job[]> {
  let query = db.selectFrom("job").selectAll()
  if (filter?.statuses?.length) {
    query = query.where("status", "in", filter.statuses)
  }
  const rows = await query
    .orderBy("position", "asc")
    .orderBy("createdAt", "asc")
    .execute()

  return rows.map(parseJob)
}

export type JobSort = "finishedAt" | "title" | "status"

export async function getQueuedJobs(): Promise<Job[]> {
  return getJobs({ statuses: ACTIVE_JOB_STATUSES })
}

// jobs joined with their book title and redacted config, for the queue ui / toast.
// search filters on book title; sort/order drive the finished-jobs list ordering
// (active jobs are always ordered by queue position).
export async function getDisplayJobs(filter?: {
  statuses?: readonly JobStatus[]
  bookUuid?: UUID
  search?: string
  sort?: JobSort
  order?: "asc" | "desc"
  limit?: number
  offset?: number
}): Promise<PublicJob[]> {
  let query = db
    .selectFrom("job")
    .leftJoin("book", "book.uuid", "job.bookUuid")
    .selectAll("job")
    .select("book.title as bookTitle")

  if (filter?.statuses?.length) {
    query = query.where("job.status", "in", filter.statuses)
  }
  if (filter?.bookUuid) {
    query = query.where("job.bookUuid", "=", filter.bookUuid)
  }
  if (filter?.search) {
    query = query.where("book.title", "like", `%${filter.search}%`)
  }

  const order = filter?.order ?? "asc"
  if (filter?.sort === "title") {
    query = query.orderBy("book.title", order)
  } else if (filter?.sort === "status") {
    query = query.orderBy("job.status", order)
  } else if (filter?.sort === "finishedAt") {
    query = query.orderBy("job.finishedAt", order)
  } else {
    query = query.orderBy("job.position", "asc").orderBy("job.createdAt", "asc")
  }

  const rows = await query
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .$if(!!filter?.limit, (qb) => qb.limit(filter!.limit!))
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .$if(!!filter?.offset, (qb) => qb.offset(filter!.offset!))
    .execute()

  return rows.map(({ bookTitle, ...row }) =>
    toPublicJob(parseJob(row), bookTitle ?? null),
  )
}

// latest non-terminal job for a book. terminal jobs are history and ignored.
export async function getActiveJobForBook(bookUuid: UUID): Promise<Job | null> {
  const row = await db
    .selectFrom("job")
    .selectAll()
    .where("bookUuid", "=", bookUuid)
    .where("status", "in", ACTIVE_JOB_STATUSES)
    .orderBy("createdAt", "desc")
    .limit(1)
    .executeTakeFirst()
  return row ? parseJob(row) : null
}

export async function updateJob(uuid: UUID, patch: JobUpdate): Promise<Job> {
  const row = await db
    .updateTable("job")
    .set(patch)
    .where("uuid", "=", uuid)
    .returningAll()
    .executeTakeFirstOrThrow()
  const parsed = parseJob(row)
  emit("jobUpdated", parsed.uuid)
  return parsed
}

export async function getNextJobPosition(): Promise<number> {
  const row = await db
    .selectFrom("job")
    .select("position")
    .where("status", "in", ACTIVE_JOB_STATUSES)
    .orderBy("position", "desc")
    .limit(1)
    .executeTakeFirst()
  return (row?.position ?? -1) + 1
}

// rewrite positions to match the given order. only queued jobs can move; a running
// job keeps its slot. unknown uuids are ignored.
export async function reorderQueuedJobs(orderedUuids: UUID[]): Promise<void> {
  await db.transaction().execute(async (tr) => {
    for (const [index, uuid] of orderedUuids.entries()) {
      await tr
        .updateTable("job")
        .set({ position: index })
        .where("uuid", "=", uuid)
        .where("status", "=", "QUEUED")
        .execute()
    }
  })
  for (const uuid of orderedUuids) emit("jobUpdated", uuid)
}

export async function deleteJob(uuid: UUID): Promise<void> {
  await db.deleteFrom("job").where("uuid", "=", uuid).execute()
  emit("jobDeleted", uuid)
}

export function nowTimestamp(): string {
  return new Date().toISOString().replace(/\.\d+/, "")
}
