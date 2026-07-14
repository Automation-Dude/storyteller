import { Stack, Text, Title } from "@mantine/core"
import type { Metadata } from "next"

import type { User } from "@/apiModels"
import { fetchApiRoute } from "@/app/fetchApiRoute"
import { SetUpEreaderClient } from "@/components/ereader/SetUpEreaderClient"
import { getSettings } from "@/database/settings"

export const metadata: Metadata = {
  title: "Set up my e-reader",
}

export const dynamic = "force-dynamic"

export default async function SetUpEreaderPage() {
  // Gate on login, and surface a clear message if the admin has not turned on
  // the features this depends on, rather than letting the flow fail mid-way.
  await fetchApiRoute<User>("/user")
  const settings = await getSettings()
  const ready = !!settings.opdsEnabled && !!settings.koreaderSyncEnabled

  return (
    <Stack>
      <Title order={1}>Set up my e-reader</Title>
      {ready ? (
        <SetUpEreaderClient />
      ) : (
        <Text>
          E-reader setup is not available yet. Ask your Storyteller
          administrator to enable the OPDS feed and KOReader sync in settings.
        </Text>
      )}
    </Stack>
  )
}
