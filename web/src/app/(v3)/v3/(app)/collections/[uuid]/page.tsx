import { withPageAuth } from "@v3/_/server/page-auth-wrapper"

import { CollectionsPageClient } from "@/app/(v3)/v3/(app)/collections/collectionsPageClient"
import { type UUID } from "@/uuid"

type CollectionPageProps = {
  params: Promise<{ uuid: UUID }>
}

// a single collection reuses the collections library view (other collections in
// the sidebar) with that collection preselected. visibility is enforced by the
// books query, which only returns collections the user can access.
export default withPageAuth<CollectionPageProps>(["bookList"])(
  async function CollectionPage({ params }) {
    const { uuid } = await params
    return <CollectionsPageClient initialCollectionUuid={uuid} />
  },
)
