import { NotFoundContent } from "@v3/_/components/not-found-content"
import { SiteHeader } from "@v3/_/components/site-header"

// in-shell 404: rendered inside the app layout (sidebar + header), e.g. when a
// page calls notFound() for a missing book / collection / shelf.
export default function NotFound() {
  return (
    <div className="flex h-screen flex-1 flex-col">
      <SiteHeader breadcrumbs={[{ label: "Not found" }]} />
      <NotFoundContent />
    </div>
  )
}
