import { Stack, Title } from "@mantine/core"
import type { Metadata } from "next"

import type { User } from "@/apiModels"
import { fetchApiRoute } from "@/app/fetchApiRoute"
import { SetUpEreaderClient } from "@/components/ereader/SetUpEreaderClient"
import { getSettings } from "@/database/settings"
import { getDeviceVerificationBaseUrl } from "@/deviceAuthorization"

export const metadata: Metadata = {
  title: "Set up my e-reader",
}

export const dynamic = "force-dynamic"

export default async function SetUpEreaderPage() {
  await fetchApiRoute<User>("/user")
  const settings = await getSettings()

  // The address a device is pointed at, from this instance's own settings (or
  // the request origin), never a hard-coded value. Shown so the person setting
  // up a device can see exactly where it will sync to. Empty if the instance
  // has not configured one yet, rather than failing the page.
  let serverUrl = ""
  try {
    serverUrl = await getDeviceVerificationBaseUrl()
  } catch {
    serverUrl = ""
  }

  return (
    <Stack>
      <Title order={1}>Set up my e-reader</Title>
      <SetUpEreaderClient
        koboSyncEnabled={!!settings.koboSyncEnabled}
        serverUrl={serverUrl}
      />
    </Stack>
  )
}
