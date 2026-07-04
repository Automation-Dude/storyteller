import { withHasPermission } from "@/auth/auth"
import { type AddTagInput, addTagsToBooks, removeTagsFromBooks } from "@/database/tags"
import { type UUID } from "@/uuid"
import { queueWritesToFiles } from "@/writeToFiles/fileWriteDistributor"

export const POST = withHasPermission("bookUpdate")(async (request) => {
  const body = (await request.json()) as {
    // bare strings stay supported for existing clients; internally we send the
    // richer {uuid} | {name, icon?, color?} shape.
    tags: (string | AddTagInput)[]
    books: UUID[]
  }
  const { tags, books } = body
  const normalized: AddTagInput[] = tags.map((t) =>
    typeof t === "string" ? { name: t } : t,
  )
  await addTagsToBooks(books, normalized)

  for (const book of books) {
    void queueWritesToFiles(book)
  }

  return new Response(null, { status: 204 })
})

export const DELETE = withHasPermission("bookUpdate")(async (request) => {
  const body = (await request.json()) as {
    tags: UUID[]
    books: UUID[]
  }
  const { tags, books } = body
  await removeTagsFromBooks(books, tags)

  for (const book of books) {
    void queueWritesToFiles(book)
  }

  return new Response(null, { status: 204 })
})
