import { Audio } from "expo-av"
import { useSyncExternalStore } from "react"

import { CLIPS, type ClipKind } from "@/data/pronunciation/audioIndex"
import { registerExtraAudioCleanup, yieldSongPlayback } from "@/lib/audioFocus"

/**
 * Plays one clip of the pronunciation memo. Only ever called from a tap: nothing here starts by itself.
 *
 * - One clip at a time: a new tap stops the clip that is playing.
 * - A song that is playing is paused first (yieldSongPlayback, the same call the harmonium makes), and the clip is
 *   unloaded when a song or the capture screen takes the audio session back (registerExtraAudioCleanup).
 * - The clip plays also when the iPhone is on silent: the person tapped it to hear it (same mode the harmonium uses).
 * - Which file is played: a recording in assets/audio/pronunciation/native/ if there is one for the id, otherwise the
 *   computer-voice clip. `clipKind` tells the UI which, so it can label it honestly.
 */

type Listener = () => void
const listeners = new Set<Listener>()
let playingId: string | null = null
let sound: Audio.Sound | null = null
/** Bumped on every tap, so a slow load from an earlier tap can tell it was replaced. */
let ticket = 0

function setPlaying(id: string | null) {
  if (playingId === id) return
  playingId = id
  for (const listener of [...listeners]) listener()
}

export function clipKind(id: string): ClipKind | null {
  return CLIPS[id]?.kind ?? null
}

async function unload() {
  const current = sound
  sound = null
  if (!current) return
  try {
    await current.stopAsync()
  } catch {
    /* already stopped */
  }
  try {
    await current.unloadAsync()
  } catch {
    /* already unloaded */
  }
}

export async function stopClip(): Promise<void> {
  ticket++
  setPlaying(null)
  await unload()
}

registerExtraAudioCleanup(stopClip)

/** Plays the clip of an audio id. Resolves "played" when it started, "missing" when the id has no clip, "error" when the device could not play it. */
export async function playClip(id: string): Promise<"played" | "missing" | "error"> {
  const entry = CLIPS[id]
  if (!entry) return "missing"
  // Tapping the clip that is playing stops it.
  if (playingId === id) {
    await stopClip()
    return "played"
  }
  const mine = ++ticket
  setPlaying(id)
  await unload()
  try {
    await yieldSongPlayback()
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    })
    const { sound: created } = await Audio.Sound.createAsync(entry.source, { shouldPlay: true, volume: 1 })
    if (mine !== ticket) {
      // another tap came while this one was loading
      await created.unloadAsync().catch(() => undefined)
      return "played"
    }
    sound = created
    created.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return
      if (status.didJustFinish && mine === ticket) void stopClip()
    })
    return "played"
  } catch {
    if (mine === ticket) setPlaying(null)
    return "error"
  }
}

/** The audio id that is playing now (null when none): re-renders the rows. */
export function usePlayingClip(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => playingId,
    () => null,
  )
}
