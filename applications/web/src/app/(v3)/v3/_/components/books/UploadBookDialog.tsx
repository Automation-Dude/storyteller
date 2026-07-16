"use client"

import { useRef } from "react"
import { v4 as uuidv4 } from "uuid"

import { UploadDialog } from "@v3/_/components/files/UploadDialog"
import { type UppyFileType } from "@v3/_/components/files/useTusUpload"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"

import { type UUID } from "@/uuid"

const nav = typeof navigator != "undefined" ? navigator : null
const agent = (nav && nav.userAgent) || ""
const ie = /Edge\/(\d+)/.test(agent) || /MSIE \d/.test(agent)
// eslint-disable-next-line @typescript-eslint/no-deprecated
const safari = !ie && !!nav && /Apple Computer/.test(nav.vendor)
const ios = safari && (/Mobile\/\w+/.test(agent) || nav.maxTouchPoints > 2)

const epubFileTypes = ["application/epub+zip", ...(ios ? [] : [".epub"])]
const audioFileTypes = ios
  ? null
  : ["video/mp4", "audio/*", "application/zip", ".m4b", ".m4a", ".zip"]

const allowedFileTypes = [...epubFileTypes, ...(audioFileTypes ?? [])].filter(
  Boolean,
)

const tusEndpoint =
  typeof window === "undefined"
    ? "/api/v2/books/upload"
    : new URL("/api/v2/books/upload", window.location.origin).toString()

export function UploadBookDialog({
  open,
  onOpenChange,
  collection,
  onBookCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  collection?: UUID
  onBookCreated?: (bookUuid: string) => void
}) {
  const t = useTranslation("UploadDialog")
  const c = useCommon()
  const bookUuidRef = useRef(uuidv4())

  function buildMeta(file: UppyFileType) {
    file.meta["bookUuid"] = bookUuidRef.current

    if (collection) {
      file.meta["collection"] = collection
    }
  }

  async function handleFinalize() {
    await fetch("/api/v2/books/upload/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookUuid: bookUuidRef.current,
        ...(collection && { collectionUuid: collection }),
      }),
    })
  }

  function handleComplete() {
    const uuid = bookUuidRef.current
    bookUuidRef.current = uuidv4()
    onBookCreated?.(uuid)
  }

  return (
    <UploadDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          bookUuidRef.current = uuidv4()
        }
        onOpenChange(next)
      }}
      title={t("uploadBookTitle")}
      description={t("uploadBookDescription")}
      endpoint={tusEndpoint}
      restrictions={{
        allowedFileTypes: ios ? null : allowedFileTypes,
      }}
      accept=".epub,audio/*,video/mp4,.m4b,.m4a,.zip"
      multiple
      hint={t("uploadBookHint")}
      buildMeta={buildMeta}
      onFinalize={handleFinalize}
      onComplete={handleComplete}
      showMetadataMode={false}
      labels={{
        metadataBehavior: t("metadataBehavior"),
        metadataMerge: c.plain("metadataBehavior.merge"),
        metadataSkip: c.plain("metadataBehavior.keep"),
        metadataOverwrite: c.plain("metadataBehavior.overwrite"),
        failedFiles: (count) => t("failedFiles", { count }),
        cancel: c.plain("actions.cancel"),
        upload: c.plain("actions.upload"),
        done: c.plain("actions.done"),
        uploadAnother: t("uploadAnother"),
      }}
    />
  )
}
