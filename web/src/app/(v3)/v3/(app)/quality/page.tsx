import { type Metadata } from "next"

import { BookSelectionProvider } from "@v3/_/hooks/use-book-selection"
import { withPageAuth } from "@v3/_/server/page-auth-wrapper"

import QualityPage from "./qualityPage"

export const metadata: Metadata = {
  title: "Alignment quality",
}

export default withPageAuth(["bookProcess"])(() => {
  return (
    <BookSelectionProvider>
      <QualityPage />
    </BookSelectionProvider>
  )
})
