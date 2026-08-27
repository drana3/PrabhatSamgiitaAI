import { Audio } from "expo-av"
import {
  reedWavDataUri,
  type SheetPlayEvent,
  westernToHz,
  westernToSampleStem,
} from "@prabhat/core"

import { HARMONIUM_SAMPLE_MODULES } from "@/lib/harmoniumSamples"

let activeSound: Audio.Sound | null = null
const heldSounds = new Map<string, Audio.Sound>()

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
  const moduleId = stem ? HARMONIUM_SAMPLE_MODULES[stem] : undefined
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
  const sound = await loadSound(western, false)
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
  const sound = await loadSound(western, true)
  heldSounds.set(western, sound)
  await sound.playAsync()
  return () => {
    heldSounds.delete(western)
    void unloadSound(sound)
  }
}

export async function playSheetEvents(events: SheetPlayEvent[]): Promise<void> {
  if (!events.length) return
  await ensureAudioMode()
  const sounds: Audio.Sound[] = []
  const timers: ReturnType<typeof setTimeout>[] = []

  try {
    for (const event of events) {
      sounds.push(await loadSound(event.western))
    }

    await Promise.all(
      sounds.map((sound, index) => {
        const event = events[index]
        if (!event) return Promise.resolve()
        const delay = Math.round(event.startSec * 1000)
        const playMs = Math.max(120, Math.round(event.durationSec * 1000))
        return new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            void sound.playAsync().then(() => {
              const stopTimer = setTimeout(() => {
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
      const timer = setTimeout(() => resolve(), totalMs)
      timers.push(timer)
    })
  } finally {
    timers.forEach((timer) => clearTimeout(timer))
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
    activeSound = null
  }
}
