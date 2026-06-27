"use client"

import { IconChevronDown } from "@tabler/icons-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { LANGUAGES } from "@storyteller-platform/ghost-story/constants"

import { Button } from "@v3/_/components/ui/button"
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@v3/_/components/ui/button-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v3/_/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v3/_/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@v3/_/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v3/_/components/ui/select"
import { Spinner } from "@v3/_/components/ui/spinner"

import { type Settings } from "@/apiModels"
import { SettingsFormProvider } from "@/app/(v3)/v3/_/components/settings-form/SettingsFormProvider"
import { ProcessingSettingsFields } from "@/app/(v3)/v3/_/components/settings-form/processing-tab"
import { type BookWithRelations } from "@/database/books"
import {
  useGetSettingsQuery,
  useProcessBookMutation,
  useUpdateSettingsMutation,
} from "@/store/api"
import { RUN_CONFIG_SETTING_KEYS, type RunConfig } from "@/work/runConfig"


// "process with options": capture transcription/audio settings for this run only,
// pre-filled from the current defaults. optionally also save the edits as the new
// defaults. requires settingsUpdate (it surfaces the same secret-bearing fields as
// the settings page); callers gate on that.
export function ProcessRunDialog({
  book,
  open,
  onOpenChange,
}: {
  book: BookWithRelations
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: settings } = useGetSettingsQuery(undefined, { skip: !open })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Process “{book.title}”</DialogTitle>
          <DialogDescription>
            These settings apply to this run only, unless you save them as defaults.
          </DialogDescription>
        </DialogHeader>

        {settings ? (
          <RunConfigForm
            book={book}
            settings={settings}
            onClose={() => { onOpenChange(false); }}
          />
        ) : (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function RunConfigForm({
  book,
  settings,
  onClose,
}: {
  book: BookWithRelations
  settings: Settings
  onClose: () => void
}) {
  const form = useForm<Settings>({ defaultValues: settings })
  // "auto" sentinel because radix select items can't have an empty value.
  const [language, setLanguage] = useState(book.language ?? "auto")
  const [processBook, { isLoading: isProcessing }] = useProcessBookMutation()
  const [updateSettings, { isLoading: isSaving }] = useUpdateSettingsMutation()

  async function start(saveAsDefaults: boolean) {
    const values = form.getValues()
    const config: Partial<RunConfig> = {
      language: language === "auto" ? null : language,
    }
    for (const key of RUN_CONFIG_SETTING_KEYS) {
      // settings and run config share these keys; copy the edited values across.
      ;(config as Record<string, unknown>)[key] = values[key]
    }

    try {
      await processBook({ uuid: book.uuid, restart: false, config }).unwrap()
      if (saveAsDefaults) {
        await updateSettings(values).unwrap()
        toast.success("Saved as defaults and started processing")
      } else {
        toast.success("Started processing")
      }
      onClose()
    } catch {
      toast.error("Failed to start processing")
    }
  }

  const busy = isProcessing || isSaving

  return (
    <SettingsFormProvider form={form} lockedSettings={new Set()}>
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="run-language">Language</FieldLabel>
          <Select
            value={language}
            onValueChange={(v) => { setLanguage(v ?? "auto"); }}
          >
            <SelectTrigger id="run-language" className="w-full">
              <SelectValue placeholder="Auto (detect from book)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (detect from book)</SelectItem>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <ProcessingSettingsFields />
      </div>

      <DialogFooter>
        <ButtonGroup>
          <Button disabled={busy} onClick={() => void start(false)}>
            {busy ? "Starting…" : "Start processing"}
          </Button>
          <ButtonGroupSeparator />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button disabled={busy} aria-label="More start options">
                  <IconChevronDown className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void start(true)}>
                Start and save as defaults
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </DialogFooter>
    </SettingsFormProvider>
  )
}
