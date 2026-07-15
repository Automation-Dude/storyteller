import { BookSelectionProvider } from "@v3/_/hooks/use-book-selection"
import { withPageAuth } from "@v3/_/server/page-auth-wrapper"

import { type UUID } from "@/uuid"

import { CollectionStandalonePage } from "./collectionStandaloneClient"

type CollectionPageProps = {
  params: Promise<{ uuid: UUID }>
}

export default withPageAuth<CollectionPageProps>(["bookList"])(
  async function CollectionPage({ params }) {
    const { uuid } = await params
    return (
      <BookSelectionProvider>
        <CollectionStandalonePage collectionUuid={uuid} />
      </BookSelectionProvider>
    )
  },
)
