import { SiteHeader } from "@/app/(v3)/v3/_/components/site-header"
import { Button } from "@/app/(v3)/v3/_/components/ui/button"
import { V3Link } from "@/app/(v3)/v3/_/components/v3-link"
import { nextAuth } from "@/auth/auth"
import { getBook } from "@/database/books"
import { type UUID } from "@/uuid"

import { BookDetailsContent } from "./bookDetailsPage"

export type BookDetailsPageProps = {
  params: Promise<{
    uuid: UUID
  }>
}

export default async function BookDetailsPage({
  params,
}: BookDetailsPageProps) {
  const { uuid } = await params
  const session = await nextAuth.auth()

  const book = await getBook(uuid, session?.user.id)

  const isError = !session?.user.id || !book

  if (isError) {
    return (
      <div className="flex flex-1 flex-col">
        <SiteHeader
          breadcrumbs={[
            { label: "Books", url: "/books" },
            { label: "Not Found" },
          ]}
        />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Book not found</h1>
            <p className="text-muted-foreground mt-2">
              The book you're looking for doesn't exist or you don't have access
              to it.
            </p>
            <Button render={<V3Link href="/books">Back to Books</V3Link>} />
          </div>
        </div>
      </div>
    )
  }

  return <BookDetailsContent book={book} />
}
