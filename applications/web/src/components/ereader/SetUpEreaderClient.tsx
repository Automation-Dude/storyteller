"use client"

import { Alert, Button, Code, List, Progress, Stack, Text } from "@mantine/core"
import { useState } from "react"

import { installToKobo } from "@/ereader/client/install"
import {
  type KoboDevice,
  isFileSystemAccessSupported,
  pickKobo,
} from "@/ereader/client/kobo"

type Phase = "idle" | "working" | "done" | "error"

type EreaderConfigResponse = {
  files: Record<string, string>
  summary: { libraryUrl: string; syncUrl: string; deviceLabel: string }
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Could not download a required file (${response.status}).`)
  }
  return new Uint8Array(await response.arrayBuffer())
}

export function SetUpEreaderClient() {
  const supported = isFileSystemAccessSupported()

  const [phase, setPhase] = useState<Phase>("idle")
  const [status, setStatus] = useState("")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [device, setDevice] = useState<KoboDevice | null>(null)

  if (!supported) {
    return (
      <Alert color="yellow" title="Use Chrome or Edge on a computer">
        Setting up an e-reader directly needs Google Chrome or Microsoft Edge on
        a computer. Please open this page in one of those, on the computer you
        will plug the e-reader into.
      </Alert>
    )
  }

  async function run() {
    setPhase("working")
    setError("")
    setProgress(0)

    try {
      setStatus("Waiting for you to choose your e-reader...")
      const kobo = await pickKobo()
      setDevice(kobo)

      setStatus(`Found your ${kobo.model}. Preparing your library...`)
      const configResponse = await fetch("/api/v2/ereader/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceLabel: kobo.model }),
      })
      if (!configResponse.ok) {
        const message = (
          (await configResponse.json().catch(() => null)) as {
            message?: string
          } | null
        )?.message
        throw new Error(
          message ??
            "Could not prepare your library. Ask your Storyteller admin to enable the OPDS feed and KOReader sync.",
        )
      }
      const config = (await configResponse.json()) as EreaderConfigResponse

      setStatus("Downloading the reader app...")
      const [koreaderZip, kfmonZip] = await Promise.all([
        fetchBytes("/api/v2/ereader/packages/koreader"),
        fetchBytes("/api/v2/ereader/packages/kfmon"),
      ])

      await installToKobo({
        device: kobo,
        koreaderZip,
        kfmonZip,
        configFiles: config.files,
        onProgress: (p) => {
          setStatus(p.message + (p.phase === "koreader" ? "..." : ""))
          if (p.phase === "koreader" && p.fraction !== undefined) {
            setProgress(Math.round(p.fraction * 100))
          } else if (p.phase === "launcher") {
            setProgress(100)
          }
        },
      })

      setPhase("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
      setPhase("error")
    }
  }

  if (phase === "done") {
    return (
      <Stack>
        <Alert color="green" title="Your e-reader is ready">
          <Stack gap="xs">
            <Text>
              You can safely unplug your {device?.model ?? "e-reader"} now.
            </Text>
            <Text>Then, on the device:</Text>
            <List type="ordered" size="sm">
              <List.Item>
                It will restart and finish installing on its own.
              </List.Item>
              <List.Item>Open KOReader from your home screen.</List.Item>
              <List.Item>
                Your library is already there, and your reading place will sync
                on its own. Nothing else to set up.
              </List.Item>
            </List>
          </Stack>
        </Alert>
      </Stack>
    )
  }

  return (
    <Stack>
      <Text>
        This will set up your e-reader so your Storyteller library is on it and
        your reading place syncs automatically. You will not need to type
        anything on the device.
      </Text>
      <Text fw={500}>Before you start:</Text>
      <List size="sm">
        <List.Item>
          Plug your e-reader into this computer with its cable.
        </List.Item>
        <List.Item>
          If the device asks, choose to <Code>Connect</Code> so the computer can
          see it.
        </List.Item>
      </List>

      {phase === "working" && (
        <Stack gap="xs">
          <Text size="sm">{status}</Text>
          <Progress value={progress} animated />
          <Text size="xs" c="dimmed">
            Please leave the device plugged in until this finishes.
          </Text>
        </Stack>
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
        w="fit-content"
      >
        {phase === "error" ? "Try again" : "Set up my e-reader"}
      </Button>
    </Stack>
  )
}
