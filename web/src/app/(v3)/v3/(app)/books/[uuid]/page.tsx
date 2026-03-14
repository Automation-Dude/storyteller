import { type UUID } from "@/uuid"

import { BookDetailsContent } from "@v3/_/components/books/BookDetailsPage"

export type BookDetailsPageProps = {
  params: Promise<{
    uuid: UUID
  }>
}

export default async function BookDetailsPage({
  params,
}: BookDetailsPageProps) {
  const { uuid } = await params

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

  return <BookDetailsContent uuid={uuid} />
}
