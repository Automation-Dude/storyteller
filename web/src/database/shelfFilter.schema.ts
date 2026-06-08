import { shelfFilterSchema } from "./shelfFilter"

export function generateShelfFilterJsonSchema() {
  return shelfFilterSchema.toJSONSchema()
}
