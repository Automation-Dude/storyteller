import { type Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { SetUpEreader } from "@v3/_/components/set-up-ereader/set-up-ereader"
import { SiteHeader } from "@v3/_/components/site-header"

import { nextAuth } from "@/auth/auth"
import { getSettings } from "@/database/settings"
import { getDeviceVerificationBaseUrl } from "@/deviceAuthorization"


export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("SetUpEreaderPage")
  return { title: t("title") }
}

export default async function SetUpEreaderPage() {
  const auth = await nextAuth.auth()
  if (!auth) redirect("/login")

  const settings = await getSettings()

  // The address a device is pointed at comes from this instance's own settings
  // (or the request origin), never a hard-coded value. Empty if none is set,
  // rather than failing the page.
  let serverUrl = ""
  try {
    serverUrl = await getDeviceVerificationBaseUrl()
  } catch {
    serverUrl = ""
  }

  const t = await getTranslations("SetUpEreaderPage")

  return (
    <>
      <SiteHeader breadcrumbs={[{ label: t("title") }]} />
      <div className="mx-auto w-full max-w-2xl p-4 md:p-6">
        <h1 className="mb-4 text-2xl font-semibold">{t("title")}</h1>
        <SetUpEreader
          koboSyncEnabled={!!settings.koboSyncEnabled}
          serverUrl={serverUrl}
        />
      </div>
    </>
  )
}
