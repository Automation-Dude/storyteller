import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { type Logger } from "pino"

import { Epub } from "@storyteller-platform/epub"
import {
  type TimingAggregator,
  createAggregator,
  synthesize as synthesizeSpeech,
} from "@storyteller-platform/ghost-story"
import { type SynthesisEngine } from "@storyteller-platform/ghost-story/constants"

/**
 * Output format of the generated audiobook. "m4b" is a single chaptered file
 * (the audiobook-native format); "mp3"/"m4a" write one track per chapter.
 */
export type SynthesisFormat = "m4b" | "mp3" | "m4a"

export interface SynthesizeOptions {
  /** Which local TTS engine to use. Defaults to "kokoro". */
  engine?: SynthesisEngine | null | undefined
  /** Engine voice id (e.g. a Kokoro voice like "af_heart"). */
  voice?: string | null | undefined
  /** Narration speed multiplier (1 = natural). */
  speed?: number | null | undefined
  /** Where the voice model is cached; persists across container recreation. */
  modelCacheDir?: string | null | undefined
  /** Output format. Defaults to "m4b". */
  format?: SynthesisFormat | null | undefined
  onProgress?: ((progress: number) => void) | null | undefined
  signal?: AbortSignal | null | undefined
  logger?: Logger | null | undefined
}

// Reduce an XHTML chapter to readable plain text. Kept deliberately simple: drop
// scripts/styles and tags, decode the handful of entities that matter for
// speech, and collapse whitespace. Narration needs the words in reading order,
// not structure.
function xhtmlToText(xhtml: string): string {
  return xhtml
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
}

function pcmToBuffer(pcm: Float32Array): Buffer {
  return Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)
}

// ffmpeg is already a hard dependency of this library (see common/ffmpeg.ts).
function runFfmpeg(
  args: string[],
  stdin: Buffer | null,
  signal?: AbortSignal | null,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      "ffmpeg",
      ["-hide_banner", "-loglevel", "error", ...args],
      { signal: signal ?? undefined },
    )
    let stderr = ""
    ffmpeg.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()))
    ffmpeg.on("error", reject)
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve()
      else
        reject(new Error(`ffmpeg exited with ${code ?? "signal"}: ${stderr}`))
    })
    if (stdin) {
      ffmpeg.stdin.on("error", reject)
      ffmpeg.stdin.write(stdin)
    }
    ffmpeg.stdin.end()
  })
}

// Encode a chapter of mono float32 PCM to a file. mp3 uses libmp3lame; m4a/m4b
// tracks use AAC.
function encodeChapter(
  pcm: Float32Array,
  sampleRate: number,
  outputPath: string,
  codec: "mp3" | "aac",
  signal?: AbortSignal | null,
): Promise<void> {
  const codecArgs =
    codec === "mp3"
      ? ["-codec:a", "libmp3lame", "-q:a", "4"]
      : ["-codec:a", "aac", "-b:a", "96k"]
  return runFfmpeg(
    [
      "-f",
      "f32le",
      "-ar",
      String(sampleRate),
      "-ac",
      "1",
      "-i",
      "pipe:0",
      ...codecArgs,
      "-y",
      outputPath,
    ],
    pcmToBuffer(pcm),
    signal,
  )
}

interface ChapterFile {
  path: string
  durationMs: number
  title: string
}

// Concatenate per-chapter AAC tracks into a single chaptered .m4b, embedding
// chapter markers so the rest of the pipeline (and audiobook players) see real
// chapters.
async function muxM4b(
  chapters: ChapterFile[],
  workDir: string,
  outputPath: string,
  signal?: AbortSignal | null,
): Promise<void> {
  const listPath = join(workDir, "concat.txt")
  await writeFile(
    listPath,
    chapters
      .map((chapter) => `file '${chapter.path.replace(/'/g, "'\\''")}'`)
      .join("\n"),
  )

  let metadata = ";FFMETADATA1\n"
  let startMs = 0
  for (const chapter of chapters) {
    const endMs = startMs + chapter.durationMs
    metadata += `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${startMs}\nEND=${endMs}\ntitle=${chapter.title}\n`
    startMs = endMs
  }
  const metadataPath = join(workDir, "chapters.txt")
  await writeFile(metadataPath, metadata)

  await runFfmpeg(
    [
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-i",
      metadataPath,
      "-map_metadata",
      "1",
      "-map_chapters",
      "1",
      "-c",
      "copy",
      "-y",
      outputPath,
    ],
    null,
    signal,
  )
}

/**
 * Generate a narration audiobook from an ebook using a local TTS engine.
 *
 * Reads the ebook in spine (reading) order, synthesizes each chapter to speech,
 * and writes the result into `outputDir` in the requested format. The output is
 * a normal audiobook the rest of the pipeline (processAudiobook, transcribe,
 * align) consumes exactly like a human-narrated one, so a readaloud can be made
 * from an ebook that has no audiobook of its own.
 */
export async function synthesize(
  ebookPath: string,
  outputDir: string,
  options: SynthesizeOptions,
): Promise<TimingAggregator> {
  const timing = createAggregator()
  const engine = options.engine ?? "kokoro"
  const format = options.format ?? "m4b"
  timing.setMetadata("engine", engine)
  timing.setMetadata("format", format)
  timing.setMetadata("voice", options.voice ?? "default")

  await mkdir(outputDir, { recursive: true })

  // For m4b, chapters are encoded to intermediate AAC tracks in a temp dir and
  // then muxed; for per-chapter formats they are written straight to outputDir.
  const chapterDir =
    format === "m4b"
      ? join(tmpdir(), `storyteller-tts-${randomUUID()}`)
      : outputDir
  if (format === "m4b") await mkdir(chapterDir, { recursive: true })

  try {
    using epub = await Epub.from(ebookPath)
    const spineItems = await epub.getSpineItems()

    const chapters: ChapterFile[] = []
    let processed = 0
    for (const item of spineItems) {
      if (options.signal?.aborted) throw new Error("Aborted")

      const xhtml = await epub.readItemContents(item.id, "utf-8")
      const text = xhtmlToText(xhtml)

      // Skip navigation, cover, and other near-empty sections so they do not
      // become silent or spurious tracks.
      if (text.length < 40) {
        processed++
        options.onProgress?.(processed / spineItems.length)
        continue
      }

      const result = await synthesizeSpeech(text, {
        engine,
        options: {
          voice: options.voice ?? undefined,
          speed: options.speed ?? undefined,
          modelCacheDir: options.modelCacheDir ?? undefined,
        },
        signal: options.signal,
      } as Parameters<typeof synthesizeSpeech>[1])
      timing.add(result.timing)

      const trackNumber = String(chapters.length + 1).padStart(5, "0")
      const ext = format === "mp3" ? "mp3" : "m4a"
      const codec = format === "mp3" ? "mp3" : "aac"
      const chapterPath = join(chapterDir, `${trackNumber}.${ext}`)
      await encodeChapter(
        result.audio,
        result.sampleRate,
        chapterPath,
        codec,
        options.signal,
      )
      chapters.push({
        path: chapterPath,
        durationMs: Math.round(
          (result.audio.length / result.sampleRate) * 1000,
        ),
        title: `Chapter ${chapters.length + 1}`,
      })

      processed++
      options.logger?.info(
        `Synthesized chapter ${processed}/${spineItems.length}`,
      )
      options.onProgress?.(processed / spineItems.length)
    }

    if (format === "m4b") {
      await muxM4b(
        chapters,
        chapterDir,
        join(outputDir, "audiobook.m4b"),
        options.signal,
      )
    }
  } finally {
    if (format === "m4b") await rm(chapterDir, { recursive: true, force: true })
  }

  return timing
}
