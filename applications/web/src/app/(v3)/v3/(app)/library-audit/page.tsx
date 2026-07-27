import { type Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { LibraryAudit } from "@v3/_/components/library-audit/library-audit"
import { SiteHeader } from "@v3/_/components/site-header"

import { nextAuth } from "@/auth/auth"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("LibraryAuditPage")
  return { title: t("title") }
}

export default async function LibraryAuditPage() {
  const auth = await nextAuth.auth()
  if (!auth) redirect("/login")
  // Whole-library scan: the same admin gate the settings page uses.
  if (!auth.user.permissions?.settingsUpdate) notFound()

  const t = await getTranslations("LibraryAuditPage")

  return (
    <>
      <SiteHeader breadcrumbs={[{ label: t("title") }]} />
      <LibraryAudit />
    </>
  )
}
