import { sql } from "kysely"

import { db } from "@/database/connection"
import { logger } from "@/logging"

async function tableColumns(name: string) {
  const tables = await db.introspection.getTables()
  const table = tables.find((t) => t.name === name)
  return table ? table.columns.map((c) => c.name) : null
}

export default async function migrate() {
  // v2 added this column in 80_import_rule_epub2_strategy, whose stub file
  // shares a content hash with the old 101_dedupe_book_series stub, so v3
  // databases recorded it as applied without ever running the js companion
  const importRule = await tableColumns("import_rule")
  if (importRule && !importRule.includes("epub2_import_strategy")) {
    await sql`
      ALTER TABLE import_rule
      ADD COLUMN epub2_import_strategy TEXT DEFAULT NULL
    `.execute(db)
  }

  // v3 briefly shipped its own identifier model (identifier as a type
  // registry + book_to_identifier), later abandoned in favor of v2's
  // identifier_type + identifier from 89_identifiers. on those databases 89's
  // CREATE TABLE IF NOT EXISTS identifier was a no-op because the name was
  // taken, so the per-book identifier table is still missing or wrongly
  // shaped. both v3 tables only ever held registry seeds, never book data.
  const identifier = await tableColumns("identifier")
  if (identifier && !identifier.includes("book_uuid")) {
    logger.info("Replacing v3 identifier experiment with the v2 model")

    await sql`PRAGMA foreign_keys = 0`.execute(db)

    await db.transaction().execute(async (trx) => {
      // carry over any url templates the v3 registry collected
      if (identifier.includes("url_template")) {
        await sql`
          UPDATE identifier_type
          SET
            url_template = (
              SELECT
                i.url_template
              FROM
                identifier i
              WHERE
                i.name = identifier_type.name
            )
          WHERE
            url_template IS NULL
        `.execute(trx)
      }

      await sql`DROP TABLE IF EXISTS book_to_identifier`.execute(trx)
      await sql`DROP TABLE identifier`.execute(trx)

      // identical to the definition in 89_identifiers.sql
      await sql`
        CREATE TABLE identifier (
          uuid text PRIMARY KEY NOT NULL DEFAULT (uuid ()),
          book_uuid text NOT NULL,
          identifier_type_uuid text NOT NULL,
          value text NOT NULL,
          ebook_uuid text,
          audiobook_uuid text,
          readaloud_uuid text,
          created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (book_uuid) REFERENCES book (uuid) ON DELETE CASCADE,
          FOREIGN KEY (identifier_type_uuid) REFERENCES identifier_type (uuid) ON DELETE CASCADE,
          FOREIGN KEY (ebook_uuid) REFERENCES ebook (uuid) ON DELETE CASCADE,
          FOREIGN KEY (audiobook_uuid) REFERENCES audiobook (uuid) ON DELETE CASCADE,
          FOREIGN KEY (readaloud_uuid) REFERENCES readaloud (uuid) ON DELETE CASCADE,
          CHECK (
            (ebook_uuid IS NOT NULL) + (audiobook_uuid IS NOT NULL) + (readaloud_uuid IS NOT NULL) <= 1
          )
        )
      `.execute(trx)

      await sql`
        CREATE TRIGGER IF NOT EXISTS identifier_update_trigger AFTER
        UPDATE ON identifier FOR EACH ROW BEGIN
        UPDATE identifier
        SET
          updated_at = CURRENT_TIMESTAMP
        WHERE
          uuid = OLD.uuid;
        END
      `.execute(trx)
    })

    await sql`PRAGMA foreign_keys = 1`.execute(db)
  }
}
