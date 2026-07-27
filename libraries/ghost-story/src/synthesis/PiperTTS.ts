import { type Timing } from "../utilities/Timing.ts"

export interface PiperOptions {
  voice?: string
  /** Playback speed multiplier applied at synthesis time (1 = natural). */
  speed?: number
  /** Where the Piper voice model is cached (mirrors the whisper model cache). */
  modelCacheDir?: string
}

export interface PiperSynthesisResult {
  /** Mono PCM samples in [-1, 1]. */
  audio: Float32Array
  sampleRate: number
}

export const inputPreference = "text" as const

// Piper is scaffolded but not yet wired to its runtime. It follows the same
// "download a native binary + model" pattern as whisper (see cli/install.ts).
// The entry point is intentionally present so the engine registry and the
// dispatcher are complete and Piper can be dropped in without touching callers.
export function synthesize(
  _text: string,
  _options: PiperOptions,
  _timing?: Timing,
  _onProgress?: ((progress: number) => void) | null,
  _signal?: AbortSignal | null,
): Promise<PiperSynthesisResult> {
  return Promise.reject(
    new Error(
      "The Piper voice engine is not installed yet. Use the Kokoro engine, " +
        "or install Piper from the narration settings.",
    ),
  )
}
