export { processAudiobook } from "./process/processAudiobook.ts"
export { type SynthesizeOptions, synthesize } from "./synthesize/synthesize.ts"
export { transcribe } from "./transcribe/transcribe.ts"
export { markup } from "./markup/markup.ts"
export { align } from "./align/align.ts"
export type {
  AlignOptions,
  AudioFileReport,
  ChapterReport,
  Report,
  UnalignedAudioFileReport,
  UnalignedChapterReport,
  UnalignedNotFoundChapterReport,
} from "./align/align.ts"
export { upgradeEpub } from "./upgradeEpub/upgradeEpub.ts"
