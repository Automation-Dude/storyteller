import { type SynthesisEngine } from "../constants.ts"
import { type KokoroOptions } from "../synthesis/KokoroTTS.ts"
import { type PiperOptions } from "../synthesis/PiperTTS.ts"
import { type TimingSummary, createTiming } from "../utilities/Timing.ts"

export interface SynthesisResult {
  /** Mono PCM samples in [-1, 1]. */
  audio: Float32Array
  sampleRate: number
  timing: TimingSummary
}

interface BaseSynthesisOptions {
  signal?: AbortSignal | null | undefined
  onProgress?: ((progress: number) => void) | null | undefined
}

// Discriminated union on `engine`, mirroring RecognitionOptions. Each engine
// carries its own strongly-typed options payload.
export type SynthesisOptions =
  | (BaseSynthesisOptions & {
      engine: "kokoro"
      options: KokoroOptions
    })
  | (BaseSynthesisOptions & {
      engine: "piper"
      options: PiperOptions
    })

/**
 * Turn text into speech using the selected local engine. The dispatch is a
 * switch that lazy-imports each engine's implementation, so onnxruntime and
 * other heavy runtimes are only loaded when synthesis actually runs. Mirror of
 * `recognize` on the recognition side.
 */
export async function synthesize(
  text: string,
  options: SynthesisOptions,
): Promise<SynthesisResult> {
  const timing = createTiming()
  timing.setMetadata("engine", options.engine)

  switch (options.engine) {
    case "kokoro": {
      const KokoroTTS = await import("../synthesis/KokoroTTS.ts")
      const result = await KokoroTTS.synthesize(
        text,
        options.options,
        timing,
        options.onProgress,
        options.signal,
      )
      return { ...result, timing: timing.summary() }
    }

    case "piper": {
      const PiperTTS = await import("../synthesis/PiperTTS.ts")
      const result = await PiperTTS.synthesize(
        text,
        options.options,
        timing,
        options.onProgress,
        options.signal,
      )
      return { ...result, timing: timing.summary() }
    }

    default: {
      const _engine: never = options
      throw new Error(
        `Unknown synthesis engine: ${(_engine as { engine: string }).engine}`,
      )
    }
  }
}

// UI-facing registry, one entry per engine, mirroring `recognitionEngines`. Both
// shipped engines are local and free; the `type` field leaves room for future
// cloud engines the community may contribute.
export const synthesisEngines: {
  id: SynthesisEngine
  name: string
  description: string
  type: "local" | "cloud"
}[] = [
  {
    id: "kokoro",
    name: "Kokoro",
    description:
      "High-quality local neural voice (Kokoro-82M). Runs on CPU, no API key or internet at synthesis time.",
    type: "local",
  },
  {
    id: "piper",
    name: "Piper",
    description:
      "Fast, lightweight local neural voice. Lower fidelity than Kokoro, quicker on modest hardware.",
    type: "local",
  },
]
