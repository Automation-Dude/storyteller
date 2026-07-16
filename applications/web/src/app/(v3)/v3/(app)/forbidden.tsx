import { ForbiddenContent } from "@v3/_/components/forbidden-content"
import { SiteHeader } from "@v3/_/components/site-header"

// in-shell 403: rendered inside the app layout (sidebar + header), e.g. when a
// page calls forbidden() for a missing book / collection / shelf.
export default function Forbidden() {
  return (
    <div className="flex h-screen flex-1 flex-col">
      <SiteHeader breadcrumbs={[{ label: "Forbidden" }]} />
      <ForbiddenContent />
    </div>
  )
}
