import { Audio } from "expo-av"
import {
  reedWavDataUri,
  shiftWesternPitch,
  type SheetPlayEvent,
  westernToHz,
  westernToSampleStem,
} from "@prabhat/core"

import { HARMONIUM_PLAYER_SAMPLE_MODULES } from "@/lib/harmoniumPlayerSamples"
import { HARMONIUM_SAMPLE_MODULES } from "@/lib/harmoniumSamples"

let voiceSemitones = 0
let activeSound: Audio.Sound | null = null
const heldSounds = new Map<string, Audio.Sound>()
let sheetGeneration = 0
let sheetFinish: (() => void) | null = null
let activeSheetTimers: ReturnType<typeof setTimeout>[] = []
let activeSheetSounds: Audio.Sound[] = []
let sheetHighlightListener: ((western: string | null) => void) | null = null
let activeSheetHandlers: SheetPlaybackHandlers | null = null

export type SheetPlaybackHandlers = {
  onKeyHighlight?: (western: string | null) => void
}

export function setHarmoniumSheetHighlightListener(
  listener: ((western: string | null) => void) | null,
): void {
  sheetHighlightListener = listener
}

function fireKeyHighlight(western: string | null): void {
  activeSheetHandlers?.onKeyHighlight?.(western)
  if (!activeSheetHandlers?.onKeyHighlight) {
    sheetHighlightListener?.(western)
  }
}

function soundingNote(western: string): string {
  return shiftWesternPitch(western, voiceSemitones)
}

export function setHarmoniumVoiceRegister(semitones: number): void {
  voiceSemitones = semitones
}

async function ensureAudioMode() {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  })
}

async function loadSound(western: string, loop = false): Promise<Audio.Sound> {
  const stem = westernToSampleStem(western)
  const moduleId = stem
    ? HARMONIUM_PLAYER_SAMPLE_MODULES[stem] ?? HARMONIUM_SAMPLE_MODULES[stem]
    : undefined
  const hz = westernToHz(western)
  const source = moduleId
    ? moduleId
    : hz
      ? { uri: reedWavDataUri(hz, 0.95) }
      : null
  if (!source) throw new Error("Unable to resolve harmonium sample")
  const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: false, volume: 0.72, isLooping: loop })
  return sound
}

async function unloadSound(sound: Audio.Sound | null): Promise<void> {
  if (!sound) return
  try {
    await sound.stopAsync()
    await sound.unloadAsync()
  } catch {
    /* ignore */
  }
}

export async function stopActiveHarmoniumNote(): Promise<void> {
  await unloadSound(activeSound)
  activeSound = null
  await Promise.all([...heldSounds.values()].map((sound) => unloadSound(sound)))
  heldSounds.clear()
}

export async function playWesternNote(western: string, durationSec = 0.45): Promise<void> {
  await ensureAudioMode()
  const sound = await loadSound(soundingNote(western), false)
  await sound.playAsync()
  setTimeout(() => {
    void unloadSound(sound)
  }, Math.max(120, Math.round(durationSec * 1000)))
}

export async function startWesternNote(western: string): Promise<() => void> {
  await ensureAudioMode()
  const previous = heldSounds.get(western)
  heldSounds.delete(western)
  await unloadSound(previous)
  const sound = await loadSound(soundingNote(western), true)
  heldSounds.set(western, sound)
  await sound.playAsync()
  return () => {
    heldSounds.delete(western)
    void unloadSound(sound)
  }
}

export function stopHarmoniumSheetPlayback(): void {
  sheetGeneration += 1
  activeSheetTimers.forEach(clearTimeout)
  activeSheetTimers = []
  sheetFinish?.()
  sheetFinish = null
  fireKeyHighlight(null)
  activeSheetHandlers = null
  void Promise.all(activeSheetSounds.map((sound) => unloadSound(sound)))
  activeSheetSounds = []
  void stopActiveHarmoniumNote()
}

export async function playSheetEvents(
  events: SheetPlayEvent[],
  handlers?: SheetPlaybackHandlers,
): Promise<void> {
  if (!events.length) return
  stopHarmoniumSheetPlayback()
  activeSheetHandlers = handlers ?? null
  const gen = sheetGeneration
  await ensureAudioMode()
  const sounds: Audio.Sound[] = []
  const timers: ReturnType<typeof setTimeout>[] = []
  activeSheetSounds = sounds
  activeSheetTimers = timers

  try {
    for (const event of events) {
      if (gen !== sheetGeneration) return
      sounds.push(await loadSound(soundingNote(event.western)))
    }

    await Promise.all(
      sounds.map((sound, index) => {
        const event = events[index]
        if (!event) return Promise.resolve()
        const delay = Math.round(event.startSec * 1000)
        const playMs = Math.max(180, Math.round(event.durationSec * 1000 + 450))
        return new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            if (gen !== sheetGeneration) {
              resolve()
              return
            }
            fireKeyHighlight(event.western)
            void sound.playAsync().then(() => {
              const stopTimer = setTimeout(() => {
                fireKeyHighlight(null)
                void sound.stopAsync().catch(() => undefined)
              }, playMs)
              timers.push(stopTimer)
              resolve()
            })
          }, delay)
          timers.push(timer)
        })
      }),
    )

    const totalMs = Math.ceil(
      ((events[events.length - 1]?.startSec ?? 0) + (events[events.length - 1]?.durationSec ?? 0) + 0.2) * 1000,
    )
    await new Promise<void>((resolve) => {
      sheetFinish = resolve
      const timer = setTimeout(() => {
        if (gen !== sheetGeneration) return
        fireKeyHighlight(null)
        activeSheetHandlers = null
        sheetFinish = null
        resolve()
      }, totalMs)
      timers.push(timer)
    })
  } finally {
    if (gen !== sheetGeneration) return
    activeSheetHandlers = null
    timers.forEach((timer) => clearTimeout(timer))
    activeSheetTimers = []
    await Promise.all(
      sounds.map(async (sound) => {
        try {
          await sound.stopAsync()
          await sound.unloadAsync()
        } catch {
          /* ignore */
        }
      }),
    )
    activeSheetSounds = []
    activeSound = null
  }
}
