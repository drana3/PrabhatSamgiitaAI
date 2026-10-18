import { Audio } from "expo-av"
import {
  harmoniumKeyboardLayout,
  reedWavDataUri,
  shiftWesternPitch,
  swaraToWestern,
  type SheetPlayEvent,
  westernToHz,
  westernToSampleStem,
} from "@prabhat/core"

import { HARMONIUM_PLAYER_SAMPLE_MODULES } from "@/lib/harmoniumPlayerSamples"
import { HARMONIUM_SAMPLE_MODULES } from "@/lib/harmoniumSamples"
import { registerExtraAudioCleanup, yieldSongPlayback } from "@/lib/audioFocus"

const POOL_SIZE = 6

let voiceSemitones = 0
let bellowsGain = 0.72
let fineTuneCents = 0
let couplerEnabled = false
let activeSound: Audio.Sound | null = null
const heldSounds = new Map<string, Audio.Sound>()
const droneSounds = new Map<string, Audio.Sound>()
const soundPools = new Map<string, Audio.Sound[]>()
let poolVoiceSemitones: number | null = null
let audioModeReady = false
let warmPromise: Promise<void> | null = null
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

function noteVolume(multiplier = 1): number {
  return Math.min(1, Math.max(0.04, bellowsGain * multiplier))
}

function fineTuneRate(): number {
  return Math.pow(2, fineTuneCents / 1200)
}

async function applyLiveSound(sound: Audio.Sound, volumeMultiplier = 1): Promise<void> {
  await sound.setVolumeAsync(noteVolume(volumeMultiplier))
  await sound.setRateAsync(fineTuneRate(), false)
}

export function setHarmoniumBellows(amount: number): void {
  bellowsGain = Math.min(1, Math.max(0.08, amount))
  void Promise.all([...droneSounds.values()].map((sound) => sound.setVolumeAsync(noteVolume(0.38))))
}

export function setHarmoniumFineTune(cents: number): void {
  fineTuneCents = Math.min(50, Math.max(-50, cents))
}

export function setHarmoniumCoupler(enabled: boolean): void {
  couplerEnabled = enabled
}

async function clearSoundPools(): Promise<void> {
  const unloading: Promise<void>[] = []
  soundPools.forEach((pool) => {
    pool.forEach((sound) => unloading.push(unloadSound(sound)))
  })
  soundPools.clear()
  poolVoiceSemitones = null
  warmPromise = null
  await Promise.all(unloading)
}

export function setHarmoniumVoiceRegister(semitones: number): void {
  if (voiceSemitones === semitones) return
  voiceSemitones = semitones
  void clearSoundPools()
}

async function ensureAudioMode() {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  })
  audioModeReady = true
}

async function ensureAudioModeOnce(force = false) {
  if (audioModeReady && !force) return
  await ensureAudioMode()
}

/** Drop cached expo-av mode so catalog playback can reclaim the session after harmonium. */
export function resetHarmoniumAudioMode(): void {
  audioModeReady = false
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

/** Preload reed samples for capture studio — low-latency key response. */
export function warmHarmoniumCaptureAudio(tonic = "C"): Promise<void> {
  if (warmPromise && poolVoiceSemitones === voiceSemitones) return warmPromise
  warmPromise = (async () => {
    await ensureAudioModeOnce()
    if (poolVoiceSemitones !== voiceSemitones) {
      await clearSoundPools()
      poolVoiceSemitones = voiceSemitones
    }
    const keys = harmoniumKeyboardLayout(tonic)
    const notes = [...new Set(keys.map((key) => soundingNote(key.western)))]
    await Promise.all(
      notes.map(async (note) => {
        const pool = soundPools.get(note) ?? []
        while (pool.length < POOL_SIZE) {
          pool.push(await loadSound(note, true))
        }
        soundPools.set(note, pool)
      }),
    )
  })().catch(() => {
    warmPromise = null
  })
  return warmPromise
}

async function borrowPooledSound(note: string): Promise<Audio.Sound> {
  const pool = soundPools.get(note)
  if (pool?.length) {
    return pool.pop()!
  }
  return loadSound(note, true)
}

async function returnPooledSound(note: string, sound: Audio.Sound): Promise<void> {
  try {
    await sound.stopAsync()
    await sound.setPositionAsync(0)
  } catch {
    /* ignore */
  }
  const pool = soundPools.get(note) ?? []
  if (pool.length < POOL_SIZE) {
    pool.push(sound)
    soundPools.set(note, pool)
    return
  }
  await unloadSound(sound)
}

export async function stopActiveHarmoniumNote(): Promise<void> {
  await unloadSound(activeSound)
  activeSound = null
  await Promise.all([...heldSounds.values()].map((sound) => unloadSound(sound)))
  heldSounds.clear()
}

export async function stopHarmoniumDrone(): Promise<void> {
  await Promise.all([...droneSounds.values()].map((sound) => unloadSound(sound)))
  droneSounds.clear()
}

export async function startHarmoniumDrone(tonic: string): Promise<void> {
  await stopHarmoniumDrone()
  await warmHarmoniumCaptureAudio(tonic)
  await ensureAudioModeOnce()
  const sa = swaraToWestern(tonic, "S", "middle")
  const pa = swaraToWestern(tonic, "P", "middle")
  const roots = [sa, pa].filter((note): note is string => Boolean(note))
  await Promise.all(
    roots.map(async (western) => {
      const note = soundingNote(western)
      const sound = await borrowPooledSound(note)
      droneSounds.set(note, sound)
      try {
        await sound.setIsLoopingAsync(true)
        await applyLiveSound(sound, 0.38)
        await sound.setPositionAsync(0)
        await sound.playAsync()
      } catch {
        droneSounds.delete(note)
        await returnPooledSound(note, sound)
      }
    }),
  )
}

export async function playWesternNote(western: string, durationSec = 0.45): Promise<void> {
  await ensureAudioModeOnce()
  const sound = await loadSound(soundingNote(western), false)
  await applyLiveSound(sound)
  await sound.playAsync()
  setTimeout(() => {
    void unloadSound(sound)
  }, Math.max(120, Math.round(durationSec * 1000)))
}

async function startHeldNote(western: string, volumeMultiplier = 1): Promise<() => void> {
  await ensureAudioModeOnce()
  const note = soundingNote(western)
  const sound = await borrowPooledSound(note)
  const holdId = `${note}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
  heldSounds.set(holdId, sound)
  try {
    await sound.setPositionAsync(0)
    await applyLiveSound(sound, volumeMultiplier)
    await sound.playAsync()
  } catch {
    heldSounds.delete(holdId)
    await returnPooledSound(note, sound)
    throw new Error("Unable to play harmonium note")
  }

  return () => {
    if (!heldSounds.has(holdId)) return
    heldSounds.delete(holdId)
    void returnPooledSound(note, sound)
  }
}

export async function startWesternNote(western: string): Promise<() => void> {
  await yieldSongPlayback()
  resetHarmoniumAudioMode()
  await ensureAudioModeOnce(true)
  const stopMain = await startHeldNote(western, 1)
  let stopCoupler: (() => void) | undefined
  if (couplerEnabled) {
    try {
      stopCoupler = await startHeldNote(shiftWesternPitch(western, 12), 0.42)
    } catch {
      stopCoupler = undefined
    }
  }
  return () => {
    stopMain()
    stopCoupler?.()
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
  await yieldSongPlayback()
  resetHarmoniumAudioMode()
  await ensureAudioModeOnce(true)
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
            void sound.playAsync().then(
              () => {
                const stopTimer = setTimeout(() => {
                  fireKeyHighlight(null)
                  void sound.stopAsync().catch(() => undefined)
                }, playMs)
                timers.push(stopTimer)
                resolve()
              },
              () => resolve(),
            )
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
    resetHarmoniumAudioMode()
  }
}

async function silenceHarmoniumVoices(): Promise<void> {
  stopHarmoniumSheetPlayback()
  await stopActiveHarmoniumNote()
  await stopHarmoniumDrone()
  await clearSoundPools()
}

registerExtraAudioCleanup(() => {
  void silenceHarmoniumVoices()
})
