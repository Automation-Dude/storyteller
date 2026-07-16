import { withPageAuth } from "@v3/_/server/page-auth-wrapper"

import { type UUID } from "@/uuid"

import { ShelfPageClient } from "./shelfPageClient"

type ShelfPageProps = {
  params: Promise<{ uuid: UUID }>
}

// shelf books are resolved per-user server-side (bookList), so a shelf only
// renders books the user can access.
export default withPageAuth<ShelfPageProps>(["bookList"])(
  async function ShelfPage({ params }) {
    const { uuid } = await params
    return <ShelfPageClient shelfUuid={uuid} />
  },
)
