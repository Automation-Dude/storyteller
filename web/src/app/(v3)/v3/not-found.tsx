import { NotFoundContent } from "@v3/_/components/not-found-content"

// standalone 404 (outside the app shell): rendered within the v3 root layout
// for unmatched top-level routes, no sidebar.
export default function NotFound() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <NotFoundContent />
    </div>
  )
}
