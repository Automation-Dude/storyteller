"use client"

import { IconChevronDown } from "@tabler/icons-react"
import { useEffect, useState } from "react"


import { Button } from "@v3/_/components/ui/button"
import { Card, CardContent } from "@v3/_/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@v3/_/components/ui/collapsible"
import { Label } from "@v3/_/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v3/_/components/ui/select"
import { Spinner } from "@v3/_/components/ui/spinner"
import { useTranslation } from "@v3/_/hooks/use-translation"

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

/** A status message, coloured by kind, standing in for an Alert component. */
function Notice({
  kind,
  title,
  children,
}: {
  kind: "info" | "success" | "warning" | "error"
  title?: string
  children: React.ReactNode
}) {
  const tone = {
    info: "border-border",
    success: "border-green-500/50 bg-green-500/5",
    warning: "border-yellow-500/50 bg-yellow-500/5",
    error: "border-destructive/50 bg-destructive/5",
  }[kind]
  return (
    <Card className={tone}>
      <CardContent className="space-y-1 py-4 text-sm">
        {title ? <p className="font-medium">{title}</p> : null}
        {children}
      </CardContent>
    </Card>
  )
}

export function SetUpEreader({
  koboSyncEnabled,
  serverUrl,
}: {
  koboSyncEnabled: boolean
  serverUrl: string
}) {
  const t = useTranslation("SetUpEreaderPage")
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
          throw new Error(message ?? t("optionsError"))
        }
        const loaded = (await response.json()) as Options
        setOptions(loaded)
        setUserId(loaded.users[0]?.id ?? null)
        setPhase("idle")
      } catch (e) {
        setError(e instanceof Error ? e.message : t("genericError"))
        setPhase("error")
      }
    })()
  }, [supported, koboSyncEnabled, t])

  async function run() {
    setPhase("working")
    setError("")
    try {
      setStatus(t("statusChoosing"))
      const kobo = await pickKobo()
      setDevice(kobo)

      setStatus(t("statusSettingUp", { model: kobo.model }))
      const response = await fetch("/api/v2/ereader/kobo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceLabel: kobo.model,
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
        throw new Error(message ?? t("setupError"))
      }
      const { apiEndpoint } = (await response.json()) as { apiEndpoint: string }

      setStatus(t("statusPointing"))
      const existing = await readFileAtPath(kobo.root, CONF_PATH)
      await writeFileAtPath(
        kobo.root,
        CONF_PATH,
        patchKoboApiEndpoint(existing, apiEndpoint),
      )

      // Read it back: a silent write failure would leave the device looking set
      // up while never showing a book.
      const written = await readFileAtPath(kobo.root, CONF_PATH)
      if (!written?.includes(apiEndpoint)) {
        throw new Error(t("confirmError"))
      }
      setPhase("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : t("genericError"))
      setPhase("error")
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }

  if (phase === "done") {
    const who = options?.users.find((user) => user.id === userId)?.name
    return (
      <div className="space-y-4">
        <Notice kind="success" title={t("doneTitle")}>
          <p>
            {t("doneUnplug", { model: device?.model ?? t("theEreader") })}
            {who ? ` ${t("doneFor", { who })}` : ""}
          </p>
          <ol className="ml-4 list-decimal space-y-1 pt-1">
            <li>{t("doneStep1")}</li>
            <li>{t("doneStep2")}</li>
            <li>{t("doneStep3")}</li>
            <li>{t("doneStep4")}</li>
          </ol>
        </Notice>
        <RevertHelp t={t} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <WhatThisIs t={t} />

      {!koboSyncEnabled ? (
        <Notice kind="warning" title={t("disabledTitle")}>
          <p>{t("disabledBody")}</p>
        </Notice>
      ) : !supported ? (
        <Notice kind="warning" title={t("unsupportedTitle")}>
          <p>{t("unsupportedBody")}</p>
        </Notice>
      ) : (
        <>
          {options?.canSetUpForOthers ? (
            <div className="space-y-1.5">
              <Label>{t("whoLabel")}</Label>
              <p className="text-muted-foreground text-sm">{t("whoHelp")}</p>
              <Select
                value={userId ?? undefined}
                items={options.users.map((user) => ({
                  value: user.id,
                  label: user.name,
                }))}
                onValueChange={(value) => {
                  setUserId(value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>{t("booksLabel")}</Label>
            <p className="text-muted-foreground text-sm">{t("booksHelp")}</p>
            <Select
              value={shelf}
              items={[
                { value: WHOLE_LIBRARY, label: t.plain("wholeLibrary") },
                ...(options?.shelves ?? []).map((s) => ({
                  value: s.uuid,
                  label: s.name,
                })),
              ]}
              onValueChange={(value) => {
                setShelf(value ?? WHOLE_LIBRARY)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WHOLE_LIBRARY}>
                  {t("wholeLibrary")}
                </SelectItem>
                {(options?.shelves ?? []).map((s) => (
                  <SelectItem key={s.uuid} value={s.uuid}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 text-sm">
            <p className="font-medium">{t("beforeYouStart")}</p>
            <ul className="text-muted-foreground ml-4 list-disc space-y-1">
              <li>{t("beforeStep1")}</li>
              <li>{t("beforeStep2")}</li>
            </ul>
          </div>

          {phase === "working" ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Spinner /> {status}
            </p>
          ) : null}

          {phase === "error" ? (
            <Notice kind="error" title={t("errorTitle")}>
              <p>{error}</p>
            </Notice>
          ) : null}

          <Button
            onClick={() => void run()}
            disabled={
              phase === "working" ||
              (!userId && Boolean(options?.canSetUpForOthers))
            }
          >
            {phase === "working" ? <Spinner /> : null}
            {phase === "error" ? t("tryAgain") : t("setUp")}
          </Button>
        </>
      )}

      <Details serverUrl={serverUrl} t={t} />
    </div>
  )
}

type Translate = ReturnType<typeof useTranslation<"SetUpEreaderPage">>

function WhatThisIs({ t }: { t: Translate }) {
  return (
    <div className="space-y-2 text-sm">
      <p>{t("whatIntro")}</p>
      <p>{t("whatAdditive")}</p>
    </div>
  )
}

function Details({ serverUrl, t }: { serverUrl: string; t: Translate }) {
  return (
    <div className="space-y-2 pt-2">
      <Section title={t("howTitle")}>
        <ul className="text-muted-foreground ml-4 list-disc space-y-1 text-sm">
          <li>{t("howLine1")}</li>
          <li>
            {t.rich("howLine2", {
              url: () => <code className="break-all">{serverUrl}</code>,
            })}
          </li>
          <li>{t("howLine3")}</li>
          <li>{t("howLine4")}</li>
        </ul>
      </Section>
      <Section title={t("goodToKnowTitle")}>
        <ul className="text-muted-foreground ml-4 list-disc space-y-1 text-sm">
          <li>{t("goodToKnow1")}</li>
          <li>{t("goodToKnow2")}</li>
          <li>{t("goodToKnow3")}</li>
        </ul>
      </Section>
      <Section title={t("undoTitle")}>
        <RevertHelp t={t} />
      </Section>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Collapsible className="rounded-md border">
      <CollapsibleTrigger className="hover:bg-muted/40 flex w-full items-center justify-between px-3 py-2 text-sm font-medium">
        {title}
        <IconChevronDown className="size-4" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function RevertHelp({ t }: { t: Translate }) {
  return (
    <p className="text-muted-foreground text-sm">
      {t.rich("revert", {
        conf: () => <code>{CONF_PATH}</code>,
        endpoint: () => <code>api_endpoint</code>,
        store: () => <code>https://storeapi.kobo.com</code>,
      })}
    </p>
  )
}
