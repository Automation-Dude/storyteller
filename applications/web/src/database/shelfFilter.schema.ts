import { shelfFilterSchema } from "@/shelves"

export function generateShelfFilterJsonSchema() {
  return shelfFilterSchema.toJSONSchema()
}
