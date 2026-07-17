"use client"

import {
  Accordion,
  Alert,
  Anchor,
  Button,
  Code,
  List,
  Loader,
  Select,
  Stack,
  Text,
} from "@mantine/core"
import { useEffect, useState } from "react"

import {
  type KoboDevice,
  isFileSystemAccessSupported,
  pickKobo,
  readFileAtPath,
  writeFileAtPath,
} from "@/ereader/client/kobo"
import { patchKoboApiEndpoint } from "@/ereader/client/plan"

type Phase = "loading" | "idle" | "working" | "done" | "error"

type Options = {
  canSetUpForOthers: boolean
  users: { id: string; name: string }[]
  shelves: { uuid: string; name: string }[]
}

/** The one file setup touches. Nothing is installed on the device. */
const CONF_PATH = ".kobo/Kobo/Kobo eReader.conf"

const WHOLE_LIBRARY = "__whole_library__"

export function SetUpEreaderClient({
  koboSyncEnabled,
  serverUrl,
}: {
  koboSyncEnabled: boolean
  serverUrl: string
}) {
  const supported = isFileSystemAccessSupported()

  const [phase, setPhase] = useState<Phase>("loading")
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [device, setDevice] = useState<KoboDevice | null>(null)
  const [options, setOptions] = useState<Options | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [shelf, setShelf] = useState<string>(WHOLE_LIBRARY)

  useEffect(() => {
    if (!supported || !koboSyncEnabled) {
      setPhase("idle")
      return
    }
    void (async () => {
      try {
        const response = await fetch("/api/v2/ereader/kobo/options")
        if (!response.ok) {
          const message = (
            (await response.json().catch(() => null)) as {
              message?: string
            } | null
          )?.message
          throw new Error(message ?? "Could not load your library's readers.")
        }
        const loaded = (await response.json()) as Options
        setOptions(loaded)
        setUserId(loaded.users[0]?.id ?? null)
        setPhase("idle")
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.")
        setPhase("error")
      }
    })()
  }, [supported, koboSyncEnabled])

  async function run() {
    setPhase("working")
    setError("")

    try {
      setStatus("Waiting for you to choose the e-reader...")
      const kobo = await pickKobo()
      setDevice(kobo)

      setStatus(`Found a ${kobo.model}. Setting up its library...`)
      const response = await fetch("/api/v2/ereader/kobo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceLabel: kobo.model,
          // Identifies the physical device, so re-running setup rotates this
          // e-reader's token rather than leaving the old one live.
          ...(kobo.serial && { serial: kobo.serial }),
          ...(userId && { userId }),
          ...(shelf !== WHOLE_LIBRARY && { collectionUuid: shelf }),
        }),
      })
      if (!response.ok) {
        const message = (
          (await response.json().catch(() => null)) as {
            message?: string
          } | null
        )?.message
        throw new Error(
          message ??
            "Could not set up the library. Ask your Storyteller admin to enable Kobo sync.",
        )
      }
      const { apiEndpoint } = (await response.json()) as { apiEndpoint: string }

      // The entire install: one line of the device's own config. Nothing is
      // copied onto it, no launcher, no reboot.
      setStatus("Pointing the e-reader at your library...")
      const existing = await readFileAtPath(kobo.root, CONF_PATH)
      await writeFileAtPath(
        kobo.root,
        CONF_PATH,
        patchKoboApiEndpoint(existing, apiEndpoint),
      )

      // Read it back: if the write silently failed, the device would look set
      // up and simply never show a book.
      const written = await readFileAtPath(kobo.root, CONF_PATH)
      if (!written?.includes(apiEndpoint)) {
        throw new Error(
          "Setup could not confirm the e-reader was configured. It has not been changed; please try again.",
        )
      }

      setPhase("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
      setPhase("error")
    }
  }

  if (phase === "loading") {
    return (
      <Stack align="center">
        <Loader />
      </Stack>
    )
  }

  if (phase === "done") {
    const who = options?.users.find((user) => user.id === userId)?.name
    return (
      <Stack>
        <Alert color="green" title="The e-reader is ready">
          <Stack gap="xs">
            <Text>
              You can unplug the {device?.model ?? "e-reader"} now.
              {who ? ` It is set up for ${who}.` : ""}
            </Text>
            <List type="ordered" size="sm">
              <List.Item>
                The books appear in its own library, over Wi-Fi. Nothing to open
                or install.
              </List.Item>
              <List.Item>
                Tap a book to download it, and read as normal.
              </List.Item>
              <List.Item>
                Add a book to the shelf here and it turns up on the device by
                itself.
              </List.Item>
              <List.Item>
                Where you stop reading syncs back here, and the mobile app can
                pick up the same place.
              </List.Item>
            </List>
          </Stack>
        </Alert>
        <RevertHelp />
      </Stack>
    )
  }

  return (
    <Stack>
      <WhatThisIs />

      {!koboSyncEnabled ? (
        <Alert color="yellow" title="Kobo sync is turned off">
          A Storyteller administrator needs to turn on <b>Kobo sync</b> in{" "}
          <Anchor href="/settings">Settings</Anchor> before an e-reader can be
          set up here.
        </Alert>
      ) : !supported ? (
        <Alert color="yellow" title="Use Chrome or Edge on a computer">
          Setting up an e-reader directly needs Google Chrome or Microsoft Edge
          on a computer. Please open this page in one of those, on the computer
          you will plug the e-reader into.
        </Alert>
      ) : (
        <>
          {options?.canSetUpForOthers && (
            <Select
              label="Who is this e-reader for?"
              description="Their reading place syncs to their own account, so pick the person who reads on it."
              data={options.users.map((user) => ({
                value: user.id,
                label: user.name,
              }))}
              value={userId}
              onChange={setUserId}
              searchable
              allowDeselect={false}
            />
          )}

          <Select
            label="Which books?"
            description="A shelf keeps it to just those books. The whole library puts everything within reach. You can change this later by setting the device up again."
            data={[
              { value: WHOLE_LIBRARY, label: "The whole library" },
              ...(options?.shelves ?? []).map((s) => ({
                value: s.uuid,
                label: s.name,
              })),
            ]}
            value={shelf}
            onChange={(value) => {
              setShelf(value ?? WHOLE_LIBRARY)
            }}
            allowDeselect={false}
          />

          <Text fw={500}>Before you start:</Text>
          <List size="sm">
            <List.Item>
              Plug the e-reader into this computer with its cable.
            </List.Item>
            <List.Item>
              If the device asks, choose to <Code>Connect</Code> so the computer
              can see it.
            </List.Item>
          </List>

          {phase === "working" && (
            <Text size="sm" c="dimmed">
              {status}
            </Text>
          )}

          {phase === "error" && (
            <Alert color="red" title="Setup did not finish">
              {error}
            </Alert>
          )}

          <Button
            onClick={() => {
              void run()
            }}
            loading={phase === "working"}
            disabled={!userId && Boolean(options?.canSetUpForOthers)}
            w="fit-content"
          >
            {phase === "error" ? "Try again" : "Set up this e-reader"}
          </Button>
        </>
      )}

      <Details serverUrl={serverUrl} />
    </Stack>
  )
}

function WhatThisIs() {
  return (
    <Stack gap="xs">
      <Text>
        This points a Kobo e-reader at your Storyteller library. The books show
        up in the device&apos;s own library, in its own reader, over Wi-Fi.{" "}
        <b>Nothing is installed on the device</b>, and nothing has to be typed
        on it.
      </Text>
      <Text>
        It is additive: the e-reader keeps working with the Kobo store and any
        books you already bought. Setup only adds your Storyteller library
        alongside them, and it can be undone at any time.
      </Text>
    </Stack>
  )
}

function Details({ serverUrl }: { serverUrl: string }) {
  return (
    <Accordion variant="separated" mt="md">
      <Accordion.Item value="how">
        <Accordion.Control>How it works</Accordion.Control>
        <Accordion.Panel>
          <List size="sm" spacing="xs">
            <List.Item>
              Setup changes one line in the e-reader&apos;s own configuration
              file so it asks this server for its library. That is the entire
              change: no app, no launcher, no reboot.
            </List.Item>
            <List.Item>
              The device points at <Code>{serverUrl}</Code>. This comes from
              your server&apos;s own settings, so each Storyteller instance
              points its devices at itself.
            </List.Item>
            <List.Item>
              Books are converted on the way to the device so the Kobo remembers
              the exact place you stopped, not just the chapter. Where you stop
              reading syncs back to Storyteller, and the mobile app can carry on
              from the same place.
            </List.Item>
            <List.Item>
              Requests Storyteller does not handle (the Kobo store, your
              account) pass straight through to Kobo, so nothing about the
              device&apos;s normal use changes.
            </List.Item>
          </List>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="good-to-know">
        <Accordion.Control>Good to know</Accordion.Control>
        <Accordion.Panel>
          <List size="sm" spacing="xs">
            <List.Item>
              A shelf limits the device to just those books. Whichever you pick,
              the reader chooses which books to download; Storyteller only makes
              them available.
            </List.Item>
            <List.Item>
              Setting the same device up again rotates its access and lets you
              change who it is for or which shelf it sees. Old access stops
              working.
            </List.Item>
            <List.Item>
              While the device points here, its store traffic runs through this
              server, so the server needs to be reachable for the store to work
              on the device.
            </List.Item>
          </List>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="undo">
        <Accordion.Control>Undoing setup</Accordion.Control>
        <Accordion.Panel>
          <RevertHelp />
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  )
}

function RevertHelp() {
  return (
    <Stack gap="xs">
      <Text size="sm">
        To return an e-reader to normal, plug it into a computer and edit{" "}
        <Code>{CONF_PATH}</Code> in the device&apos;s storage: set the{" "}
        <Code>api_endpoint</Code> line back to{" "}
        <Code>https://storeapi.kobo.com</Code>, then eject. Its own books and
        settings are never touched, so nothing else needs undoing.
      </Text>
    </Stack>
  )
}
