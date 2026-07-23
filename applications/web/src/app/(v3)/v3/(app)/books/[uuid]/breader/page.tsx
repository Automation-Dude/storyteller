import { notFound } from "next/navigation"

import { withPageAuth } from "@/app/(v3)/v3/_/server/page-auth-wrapper"
import { getBook } from "@/database/books"
import { type UUID } from "@/uuid"

import { Reader } from "./Reader"

export type BookReaderPageProps = {
  params: Promise<{
    uuid: UUID
  }>
}

export default withPageAuth<BookReaderPageProps>(["bookRead"])(
  async function BookReaderPage({ params }, user) {
    const { uuid } = await params

    const book = await getBook(uuid, user.id)

    if (!book) {
      notFound()
    }

    return <Reader book={book} />
  },
)
