import { sql } from "kysely"

import { db } from "@/database/connection"

export default async function migrate() {
  await db.transaction().execute(async (trx) => {
    // append the alignment-quality entry to every user's "Main" group. it is
    // permission-gated at render time, so seeding it for everyone is harmless.
    const mainGroups = await sql<{ uuid: string; userId: string }>`
      SELECT uuid, user_id as "userId"
      FROM sidebar_group
      WHERE name = 'Main'
    `.execute(trx)

    for (const group of mainGroups.rows) {
      // idempotency: skip users who already have the entry.
      const existing = await sql<{ uuid: string }>`
        SELECT uuid FROM sidebar_item
        WHERE user_id = ${group.userId}
          AND kind = 'builtin'
          AND builtin_key = 'alignment-quality'
      `.execute(trx)

      if (existing.rows.length > 0) continue

      const maxPos = await sql<{ maxPos: number | null }>`
        SELECT MAX(position) as "maxPos"
        FROM sidebar_item
        WHERE group_uuid = ${group.uuid}
      `.execute(trx)

      const nextPos = (maxPos.rows[0]?.maxPos ?? -1) + 1

      await sql`
        INSERT INTO sidebar_item (uuid, user_id, group_uuid, kind, builtin_key, position, hidden)
        VALUES (${crypto.randomUUID()}, ${group.userId}, ${group.uuid}, 'builtin', 'alignment-quality', ${nextPos}, 0)
      `.execute(trx)
    }
  })
}
