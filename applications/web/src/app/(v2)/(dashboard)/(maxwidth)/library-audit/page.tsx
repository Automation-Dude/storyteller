import type { Metadata } from "next"

import { LibraryAudit } from "@/components/libraryAudit/LibraryAudit"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Library audit",
}

export default function LibraryAuditPage() {
  return <LibraryAudit />
}
