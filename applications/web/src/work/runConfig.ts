import { z } from "zod"

import { type Settings } from "@/apiModels"
import { SettingsSchema } from "@/database/settingsTypes"

// the transcription/alignment settings a single align run actually consumes (see
// worker.ts). captured per job at enqueue so a run is unaffected by later edits to
// global settings, and so you can transcribe one book with a different model/language
// without touching the defaults.
export const RUN_CONFIG_SETTING_KEYS = [
  // split tracks
  "maxTrackLength",
  "codec",
  "bitrate",
  "parallelTranscodes",
  // transcription
  "transcriptionEngine",
  "whisperModel",
  "whisperThreads",
  "whisperCpuFallback",
  "parallelTranscribes",
  "whisperServerUrl",
  "whisperServerApiKey",
  "googleCloudApiKey",
  "azureSubscriptionKey",
  "azureServiceRegion",
  "amazonTranscribeRegion",
  "amazonTranscribeAccessKeyId",
  "amazonTranscribeSecretAccessKey",
  "amazonTranscribeBucketName",
  "openAiApiKey",
  "openAiOrganization",
  "openAiBaseUrl",
  "openAiModelName",
  "deepgramApiKey",
  "deepgramModel",
] as const

export const RunConfigSchema = SettingsSchema.pick(
  Object.fromEntries(RUN_CONFIG_SETTING_KEYS.map((k) => [k, true])) as {
    [K in (typeof RUN_CONFIG_SETTING_KEYS)[number]]: true
  },
).extend({
  // bcp-47 language tag for the run, defaults to the book's language. null means
  // fall back to the ebook's declared language at transcribe time.
  language: z.string().nullable(),
})

export type RunConfig = z.infer<typeof RunConfigSchema>

// a non-secret summary safe to send to the client (the full config carries api
// keys). used by the queue ui / toast to show what a run is doing.
export type RunConfigSummary = Pick<
  RunConfig,
  | "transcriptionEngine"
  | "whisperModel"
  | "language"
  | "codec"
  | "bitrate"
  | "maxTrackLength"
>

export function summarizeRunConfig(
  config: RunConfig | null,
): RunConfigSummary | null {
  if (!config) return null
  return {
    transcriptionEngine: config.transcriptionEngine,
    whisperModel: config.whisperModel,
    language: config.language,
    codec: config.codec,
    bitrate: config.bitrate,
    maxTrackLength: config.maxTrackLength,
  }
}

// build a validated run config from global settings + the book's language, with
// optional per-run overrides layered on top.
export function buildRunConfig(
  settings: Settings,
  bookLanguage: string | null,
  overrides: Partial<RunConfig> = {},
): RunConfig {
  const base: Record<string, unknown> = { language: bookLanguage }
  for (const key of RUN_CONFIG_SETTING_KEYS) {
    base[key] = settings[key]
  }
  return RunConfigSchema.parse({ ...base, ...overrides })
}
