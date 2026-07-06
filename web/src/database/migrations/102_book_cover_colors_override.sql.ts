import { db } from "@/database/connection"
import { logger } from "@/logging"

// adds a book-level manual override of the cover palette. the per-format
// coverColors stay the (revertible) source of truth; this column, when set,
// takes precedence. clearing it back to null is "reread colors from cover".
export default async function migrate() {
  logger.info("Adding book cover_colors_override column")

  const [book] = (await db.introspection.getTables()).filter(
    (table) => table.name === "book",
  )

  if (book?.columns.find((column) => column.name === "cover_colors_override")) {
    return
  }

  await db.schema
    .alterTable("book")
    .addColumn("cover_colors_override", "text")
    .execute()
}
