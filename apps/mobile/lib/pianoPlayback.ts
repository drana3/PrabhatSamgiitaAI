import { Audio } from "expo-av"

import { registerExtraAudioCleanup, yieldSongPlayback } from "@/lib/audioFocus"
import { startWesternNote } from "@/lib/harmoniumPlayback"
import { westernOfMidi } from "@/lib/pianoNotes/keys"
import { PIANO_SAMPLE_MODULES, sampleFor } from "@/lib/pianoSamples"

/**
 * The piano sound. A key sounds on touch-down. A real piano note rings out and dies by itself, so there is no "hold":
 * `playPianoKey` starts it and returns a function that lets it go early. A sample that cannot load (or a key out of
 * the bank's reach) falls back to the harmonium reed, so a key is never silent. Sounds are read when played, so the
 * bank is loaded on first use (`warmPiano`), not at start-up.
 */
const VOICES_PER_SAMPLE = 3
const pool = new Map<number, Audio.Sound[]>()
const next = new Map<number, number>()
let warming: Promise<void> | null = null
let modeReady = false

async function ensureMode() {
  if (modeReady) return
  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false })
  modeReady = true
}

async function load(module: number): Promise<Audio.Sound> {
  const { sound } = await Audio.Sound.createAsync(module, { shouldPlay: false, volume: 0.9, progressUpdateIntervalMillis: 1000 })
  return sound
}

/** Load the bank once (14 short files). Safe to call again; a failure is remembered as "no piano" for this run. */
export function warmPiano(): Promise<void> {
  warming ??= (async () => {
    await ensureMode()
    for (const { midi, module } of PIANO_SAMPLE_MODULES) {
      const voices: Audio.Sound[] = []
      for (let i = 0; i < VOICES_PER_SAMPLE; i += 1) voices.push(await load(module))
      pool.set(midi, voices)
    }
  })().catch((error) => {
    warming = null
    throw error
  })
  return warming
}

export async function playPianoKey(midi: number, volume = 0.9): Promise<() => void> {
  const pick = sampleFor(midi)
  if (!pick) return startWesternNote(westernOfMidi(midi))
  try {
    await yieldSongPlayback()
    await warmPiano()
    const voices = pool.get(pick.sampleMidi)
    if (!voices || voices.length === 0) throw new Error("no voices")
    const index = ((next.get(pick.sampleMidi) ?? 0) + 1) % voices.length
    next.set(pick.sampleMidi, index)
    const sound = voices[index]!
    await sound.setStatusAsync({ positionMillis: 0, rate: pick.rate, shouldCorrectPitch: false, volume, shouldPlay: true })
    return () => {
      void sound.setVolumeAsync(0).then(() => sound.pauseAsync()).catch(() => undefined)
    }
  } catch {
    return startWesternNote(westernOfMidi(midi))
  }
}

export async function stopPiano(): Promise<void> {
  await Promise.all([...pool.values()].flat().map((sound) => sound.stopAsync().catch(() => undefined)))
}

registerExtraAudioCleanup(() => {
  void stopPiano()
})
