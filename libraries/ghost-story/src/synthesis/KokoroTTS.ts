import { join } from "node:path"

import {
  DEFAULT_KOKORO_VOICE,
  KOKORO_MODEL_ID,
  type KokoroVoice,
} from "../constants.ts"
import { getAppDataDir } from "../utilities/FileSystem.ts"
import { type Timing, createTiming } from "../utilities/Timing.ts"

export type KokoroDtype = "fp32" | "fp16" | "q8" | "q4" | "q4f16"

export interface KokoroOptions {
  voice?: KokoroVoice
  /** Playback speed multiplier applied at synthesis time (1 = natural). */
  speed?: number
  /**
   * Where the ONNX weights and voice packs are cached. Defaults to the
   * transformers.js cache; point this at the ghost-story app-data dir so the
   * download survives container recreation (mirrors the whisper model cache).
   */
  modelCacheDir?: string
  /** Quantization of the ONNX weights. q8 is the best quality/speed on CPU. */
  dtype?: KokoroDtype
}

export interface KokoroSynthesisResult {
  /** Mono PCM samples in [-1, 1]. */
  audio: Float32Array
  sampleRate: number
}

export const inputPreference = "text" as const

// Minimal structural view of the parts of kokoro-js we depend on, kept local so
// the rest of ghost-story never needs the dependency's types.
interface RawKokoroAudio {
  audio: Float32Array
  sampling_rate: number
}
interface KokoroModel {
  generate(
    text: string,
    opts: { voice: string; speed: number },
  ): Promise<RawKokoroAudio>
}

// kokoro-js (transformers.js + onnxruntime) is loaded lazily and cached, so that
// importing this module for its types never pulls in the runtime, and repeated
// synthesis reuses one in-memory model.
let modelPromise: Promise<KokoroModel> | null = null
let loadedKey: string | null = null

/** Download-progress event surfaced from transformers.js, normalized. */
export interface KokoroDownloadEvent {
  status: string
  file?: string
  /** Percentage 0-100 for the current file, when known. */
  progress?: number
  loaded?: number
  total?: number
}

async function loadModel(
  dtype: KokoroDtype,
  modelCacheDir: string | undefined,
  onDownload?: ((event: KokoroDownloadEvent) => void)  ,
): Promise<KokoroModel> {
  // Persist the model in the ghost-story app-data dir (the same cache volume as
  // the whisper models) so it survives container recreation, rather than the
  // transformers.js default under the home cache.
  const { env } = await import("@huggingface/transformers")
  env.cacheDir =
    modelCacheDir ?? join(getAppDataDir("ghost-story"), "tts-models")
  const { KokoroTTS } = await import("kokoro-js")
  // dtype/device are kokoro-js options; progress_callback is passed through to
  // transformers.js. Typed loosely because kokoro-js does not surface it.
  const fromPretrainedOptions: Record<string, unknown> = {
    dtype,
    device: "cpu",
  }
  if (onDownload) {
    fromPretrainedOptions["progress_callback"] = onDownload
  }
  const model = await KokoroTTS.from_pretrained(
    KOKORO_MODEL_ID,
    fromPretrainedOptions as Parameters<typeof KokoroTTS.from_pretrained>[1],
  )
  return model as unknown as KokoroModel
}

function getModel(options: KokoroOptions): Promise<KokoroModel> {
  const dtype = options.dtype ?? "q8"
  const key = `${dtype}:${options.modelCacheDir ?? ""}`
  if (!modelPromise || loadedKey !== key) {
    loadedKey = key
    modelPromise = loadModel(dtype, options.modelCacheDir)
  }
  return modelPromise
}

/**
 * Ensure the Kokoro model + voices are downloaded and cached, reporting download
 * progress. This is what the "download voice model" GUI control calls: on first
 * run it fetches the weights into `modelCacheDir` (point it at the ghost-story
 * app-data dir so it persists), and it primes the in-memory model so the next
 * synthesis is instant. Idempotent — a no-op once cached.
 */
export async function ensureKokoroInstalled(
  options: {
    modelCacheDir?: string
    dtype?: KokoroDtype
    onProgress?: (event: KokoroDownloadEvent) => void
  } = {},
): Promise<void> {
  const dtype = options.dtype ?? "q8"
  loadedKey = `${dtype}:${options.modelCacheDir ?? ""}`
  modelPromise = loadModel(dtype, options.modelCacheDir, options.onProgress)
  await modelPromise
}

// Kokoro synthesises up to a fixed token budget per call, so long input is split
// on sentence boundaries into chunks and the resulting audio is concatenated.
// Splitting on sentences keeps the prosody natural across the seams.
export function chunkText(text: string, maxChars = 400): string[] {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) return []
  const sentences = normalized.match(/[^.!?]+[.!?]*\s*/g) ?? [normalized]

  const chunks: string[] = []
  let current = ""
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > maxChars) {
      chunks.push(current.trim())
      current = ""
    }
    current += sentence
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

function concatSamples(parts: Float32Array[]): Float32Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Float32Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

export async function synthesize(
  text: string,
  options: KokoroOptions,
  timing: Timing = createTiming(),
  onProgress?: ((progress: number) => void) | null,
  signal?: AbortSignal | null,
): Promise<KokoroSynthesisResult> {
  const voice = options.voice ?? DEFAULT_KOKORO_VOICE
  const speed = options.speed ?? 1

  timing.setMetadata("voice", voice)
  timing.setMetadata("speed", speed)

  const model = await timing.timeAsync("load_model", () => getModel(options))

  const chunks = chunkText(text)
  if (!chunks.length) {
    return { audio: new Float32Array(0), sampleRate: 24000 }
  }

  const parts: Float32Array[] = []
  let sampleRate = 24000
  for (let index = 0; index < chunks.length; index++) {
    if (signal?.aborted) throw new Error("Aborted")
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const chunk = chunks[index]!
    const result = await timing.timeAsync("generate", () =>
      model.generate(chunk, { voice, speed }),
    )
    parts.push(result.audio)
    sampleRate = result.sampling_rate
    onProgress?.((index + 1) / chunks.length)
  }

  return { audio: concatSamples(parts), sampleRate }
}
