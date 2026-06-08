"use client"

import { useState } from "react"

import { ImportFromServerDialog } from "@v3/_/components/files/ImportFromServerDialog"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type ImportMode } from "@/database/settingsTypes"
import { useCreateBookMutation } from "@/store/api"
import { type UUID } from "@/uuid"

export function ImportBookDialog({
  open,
  onOpenChange,
  collection,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  collection?: UUID
}) {
  const t = useTranslation("ImportFromServerDialog")
  const [createBook, { isLoading }] = useCreateBookMutation()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(paths: string[], importMode: ImportMode) {
    setError(null)

    try {
      await createBook({
        paths,
        collection,
        importMode,
      }).unwrap()

      onOpenChange(false)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("errorGeneric"),
      )
    }
  }

  return (
    <ImportFromServerDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null)
        onOpenChange(next)
      }}
      title={t("importBooksTitle")}
      description={t("importBooksDescription")}
      multiple
      onSubmit={(paths, importMode) => void handleSubmit(paths, importMode)}
      isSubmitting={isLoading}
      submitLabel={t("import")}
      showMetadataMode={false}
      error={error}
      labels={{
        importMode: t("importMode"),
        importModeReference: t("importModeReference"),
        importModeCopy: t("importModeCopy"),
        importModeMove: t("importModeMove"),
        importModeHardlink: t("importModeHardlink"),
        metadataBehavior: t("metadataBehavior"),
        metadataMerge: t("metadataMerge"),
        metadataSkip: t("metadataSkip"),
        metadataOverwrite: t("metadataOverwrite"),
        selected: t("selected"),
        cancel: t("cancel"),
      }}
    />
  )
}
