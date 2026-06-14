import { type Insertable, type Selectable, type Updateable } from "kysely"

import { type UUID } from "@/uuid"

import { db } from "./connection"
import {
  type RatingDimensionScores,
  computeRatingAverage,
} from "./ratingDimensions"
import { type DB } from "./schema"

export type UserBookRating = Selectable<DB["userBookRating"]>
export type NewUserBookRating = Insertable<DB["userBookRating"]>
export type UserBookRatingUpdate = Updateable<DB["userBookRating"]>

export async function getUserBookRating(userId: UUID, bookUuid: UUID) {
  return db
    .selectFrom("userBookRating")
    .selectAll()
    .where("userId", "=", userId)
    .where("bookUuid", "=", bookUuid)
    .executeTakeFirst()
}

export async function getUserRatings(userId: UUID) {
  return db
    .selectFrom("userBookRating")
    .selectAll()
    .where("userId", "=", userId)
    .execute()
}

export async function setUserBookRating(
  userId: UUID,
  bookUuid: UUID,
  values: {
    rating?: number | null
    review?: string | null
    dimensions?: RatingDimensionScores | null
  },
): Promise<UserBookRating | null> {
  // only the columns explicitly present in the request are written, so review
  // and rating stay independently updatable
  const patch: {
    rating?: number | null
    review?: string | null
    dimensions?: string | null
  } = {}

  if (values.review !== undefined) patch.review = values.review

  if (values.dimensions !== undefined) {
    // the multidimensional rating is authoritative for the star rating: the
    // server computes the average so storage is always in sync. an empty /
    // fully-deselected set clears it.
    const scores =
      values.dimensions && Object.values(values.dimensions).length
        ? values.dimensions
        : null
    patch.dimensions = scores ? JSON.stringify(scores) : null
    patch.rating = computeRatingAverage(scores)
  } else if (values.rating !== undefined) {
    patch.rating = values.rating
  }

  // merge against the current row so the CHECK (rating or review) holds: when
  // nothing is left to store we remove the row instead of writing a null/null
  const existing = await getUserBookRating(userId, bookUuid)
  const nextRating = patch.rating !== undefined ? patch.rating : existing?.rating
  const nextReview = patch.review !== undefined ? patch.review : existing?.review

  if (nextRating == null && nextReview == null) {
    await deleteUserBookRating(userId, bookUuid)
    return null
  }

  return db
    .insertInto("userBookRating")
    .values({ userId, bookUuid, ...patch })
    .onConflict((oc) => oc.columns(["userId", "bookUuid"]).doUpdateSet(patch))
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function deleteUserBookRating(userId: UUID, bookUuid: UUID) {
  await db
    .deleteFrom("userBookRating")
    .where("userId", "=", userId)
    .where("bookUuid", "=", bookUuid)
    .execute()
}
