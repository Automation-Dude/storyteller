export {
  type AudioInput,
  type RecognitionOptions,
  type RecognitionResult,
  recognitionEngines,
  recognize,
} from "./api/Recognition.ts"
export {
  type SynthesisOptions,
  type SynthesisResult,
  synthesisEngines,
  synthesize,
} from "./api/Synthesis.ts"
export {
  type KokoroDtype,
  type KokoroOptions,
  type KokoroSynthesisResult,
  chunkText as chunkKokoroText,
  synthesize as synthesizeKokoro,
} from "./synthesis/KokoroTTS.ts"
export {
  type PiperOptions,
  type PiperSynthesisResult,
  synthesize as synthesizePiper,
} from "./synthesis/PiperTTS.ts"
export {
  type AudioFormat,
  type AudioFormatInfo,
  type AudioSource,
  type AudioSourceFromBuffer,
  type AudioSourceFromFile,
  type AudioSourceFromStream,
  type ConversionOptions,
  type PreparedAudio,
  type RawAudioInput,
  type ServiceCapabilities,
  audioSourceFromBuffer,
  audioSourceFromFile,
  audioSourceFromStream,
  convertToBuffer,
  convertToFile,
  createStreamingConversion,
  formatFromExtension,
  formatToExtension,
  getFormat,
  getFormatInfo,
  getTargetFormat,
  isAudioSource,
  needsConversion,
  normalizeToAudioSource,
  prepareForService,
  prepareWavForService,
  serviceCapabilities,
  toBuffer,
  toFilePath,
  toReadStream,
} from "./audio/index.ts"
export {
  applyLegacyCpuFallback,
  detectPlatform,
  getConfiguredVariant,
  getInstallDir,
  getModelDir,
  getModelPath,
  getVadModelPath,
  getWhisperExecutablePath,
  getWhisperServerExecutablePath,
  isValidModel,
  resolveVariant,
} from "./cli/config.ts"
export {
  type InstallBinaryOptions,
  type InstallModelOptions,
  type InstallVadModelOptions,
  ensureWhisperInstalled,
  installBinary,
  installModel,
  installVadModel,
} from "./cli/install.ts"
export {
  type ConversionMode,
  getConfig,
  getConversionMode,
  isTimingEnabled,
  setConversionMode,
  setTimingEnabled,
} from "./config.ts"
export {
  type OpenAICloudSTTOptions,
  type RecognitionResult as OpenAIResult,
  inputPreference as openaiInputPreference,
  recognize as recognizeOpenAI,
} from "./recognition/OpenAICloudSTT.ts"
export {
  type RecognitionResult as WhisperCppResult,
  type WhisperCppModelId,
  type WhisperCppOptions,
  inputPreference as whisperCppInputPreference,
  recognize as recognizeWhisperCpp,
} from "./recognition/WhisperCppSTT.ts"
export {
  type RecognitionResult as WhisperServerResult,
  type WhisperServerOptions,
  inputPreference as whisperServerInputPreference,
  recognize as recognizeWhisperServer,
} from "./recognition/WhisperServerSTT.ts"
export type {
  Timeline,
  TimelineEntry,
  TimelineEntryType,
} from "./utilities/Timeline.ts"
export {
  spacelessScriptPattern,
  spacelessScripts,
  startsWithSpacelessScript,
} from "./utilities/SpacelessScripts.ts"
export {
  type AggregatedStats,
  type PhaseTiming,
  Timing,
  TimingAggregator,
  type TimingSpan,
  type TimingSummary,
  createAggregator,
  createTiming,
  formatDuration,
  formatPercentage,
  formatSingleReport,
  printSingleReport,
} from "./utilities/Timing.ts"
export {
  type SileroOptions,
  type VadSegment,
  detectVoiceActivity,
  ensureVadInstalled,
  segmentsToTimeline,
} from "./vad/Silero.ts"

// export * from "./constants.ts"
