import { zodToJsonSchema } from "zod-to-json-schema"

import { shelfFilterSchema } from "./shelfFilter"

export function generateShelfFilterJsonSchema() {
  return zodToJsonSchema(shelfFilterSchema, {
    name: "ShelfFilter",
    $refStrategy: "none",
  })
}
