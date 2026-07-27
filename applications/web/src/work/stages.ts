import { type Readaloud } from "@/database/schema"

export const STAGE_ORDER: Record<Readaloud["currentStage"], number> = {
  GENERATE_AUDIO: 0,
  SPLIT_TRACKS: 1,
  TRANSCRIBE_CHAPTERS: 2,
  SYNC_CHAPTERS: 3,
}
