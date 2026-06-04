import { notFound } from "next/navigation"

import { BookDetailsContent } from "@v3/_/components/books/BookDetailsPage"
import { withPageAuth } from "@v3/_/server/page-auth-wrapper"

import { hasPermission } from "@/auth/auth"
import { getBook } from "@/database/books"
import { ASSETS_DIR } from "@/directories"
import { type UUID } from "@/uuid"

export type BookDetailsPageProps = {
  params: Promise<{
    uuid: UUID
  }>
}

export default withPageAuth<BookDetailsPageProps>(["bookRead"])(
  async function BookDetailsPage({ params }, user) {
    const { uuid } = await params

    const book = await getBook(uuid, user.id)

    if (!book) {
      notFound()
    }

    // const book = await getBook(uuid, session?.user.id)

    // const isError = !session?.user.id || !book

    // if (isError) {
    //   return (
    //     <div className="flex flex-1 flex-col">
    //       <SiteHeader
    //         breadcrumbs={[
    //           { label: "Books", url: "/books" },
    //           { label: "Not Found" },
    //         ]}
    //       />
    //       <div className="flex flex-1 items-center justify-center">
    //         <div className="text-center">
    //           <h1 className="text-2xl font-bold">Book not found</h1>
    //           <p className="text-muted-foreground mt-2">
    //             The book you're looking for doesn't exist or you don't have access
    //             to it.
    //           </p>
    //           <Button render={<V3Link href="/books">Back to Books</V3Link>} />
    //         </div>
    //       </div>
    //     </div>
    //   )
    // }

    return (
      <BookDetailsContent
        uuid={uuid}
        canEdit={hasPermission("bookUpdate", user)}
        canDownload={hasPermission("bookDownload", user)}
        canDelete={hasPermission("bookDelete", user)}
        canProcess={hasPermission("bookProcess", user)}
        assetsDir={ASSETS_DIR}
        initialBook={book}
      />
    )
  },
)
