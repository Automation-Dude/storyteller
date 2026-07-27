"use client"

import { useRef, useState } from "react"

/**
 * Plays a pre-generated narration sample for a Kokoro voice, inline, with no
 * download. The samples are static assets at `/tts-samples/<voice>.mp3`, one per
 * voice, so previewing a voice is instant and never touches the synthesis engine.
 */
export function useVoiceSample() {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function play(voice: string) {
    audioRef.current?.pause()
    const audio = new Audio(`/tts-samples/${voice}.mp3`)
    audioRef.current = audio
    setPlaying(true)
    const stop = () => {
      setPlaying(false)
    }
    audio.addEventListener("ended", stop)
    audio.addEventListener("error", stop)
    void audio.play().catch(stop)
  }

  return { playing, play }
}
