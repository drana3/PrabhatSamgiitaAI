"use client"

import {
  shiftWesternPitch,
  swaraToWestern,
  type SheetPlayEvent,
} from "@prabhat/core"

const SAMPLE_FILES = [
  "A2.mp3", "A3.mp3", "A4.mp3", "As2.mp3", "As3.mp3", "As4.mp3",
  "B2.mp3", "B3.mp3", "B4.mp3",
  "C2.mp3", "C3.mp3", "C4.mp3", "C5.mp3", "Cs2.mp3", "Cs3.mp3", "Cs4.mp3", "Cs5.mp3",
  "D2.mp3", "D3.mp3", "D4.mp3", "D5.mp3", "Ds2.mp3", "Ds3.mp3", "Ds4.mp3",
  "E2.mp3", "E3.mp3", "E4.mp3",
  "F2.mp3", "F3.mp3", "F4.mp3", "Fs2.mp3", "Fs3.mp3",
  "G2.mp3", "G3.mp3", "G4.mp3", "Gs2.mp3", "Gs3.mp3", "Gs4.mp3",
] as const

const SAMPLE_BASE = "/audio/harmonium-player/"

type ToneModule = typeof import("tone")

type Player = {
  Tone: ToneModule
  sampler: import("tone").Sampler
  volume: import("tone").Volume
}

let playerPromise: Promise<Player | null> | null = null
let droneNotes: string[] = []
let voiceSemitones = 0
let playbackGeneration = 0
let sheetFinished: (() => void) | null = null
let cachedPlayer: Player | null = null

function fileToNote(file: string): string {
  const match = file.match(/^([A-G])(s)?(\d)\.mp3$/)
  if (!match) return file.replace(".mp3", "")
  return match[2] ? `${match[1]}#${match[3]}` : `${match[1]}${match[3]}`
}

function sampleUrls(): Record<string, string> {
  return Object.fromEntries(SAMPLE_FILES.map((file) => [fileToNote(file), file]))
}

async function createPlayer(): Promise<Player | null> {
  if (typeof window === "undefined") return null
  const Tone = await import("tone")
  await Tone.start()
  const volume = new Tone.Volume(-8).toDestination()
  const sampler = new Tone.Sampler({
    urls: sampleUrls(),
    baseUrl: SAMPLE_BASE,
    attack: 0.04,
    release: 0.32,
  }).connect(volume)
  await Tone.loaded()
  const created = { Tone, sampler, volume }
  cachedPlayer = created
  return created
}

export async function ensureHarmoniumPlayer(): Promise<boolean> {
  if (!playerPromise) playerPromise = createPlayer().catch(() => null)
  const player = await playerPromise
  return Boolean(player)
}

async function getPlayer(): Promise<Player | null> {
  if (!playerPromise) playerPromise = createPlayer().catch(() => null)
  return playerPromise
}

export function setHarmoniumBellows(amount: number): void {
  const gain = Math.min(1, Math.max(0.08, amount))
  void getPlayer().then((player) => {
    if (!player) return
    player.volume.volume.value = player.Tone.gainToDb(gain)
  })
}

function soundingNote(western: string): string {
  return shiftWesternPitch(western, voiceSemitones)
}

export function setHarmoniumVoiceRegister(semitones: number): void {
  voiceSemitones = semitones
}

export function setHarmoniumFineTune(cents: number): void {
  const detune = Math.min(50, Math.max(-50, cents))
  void getPlayer().then((player) => {
    if (!player) return
    const sampler = player.sampler as import("tone").Sampler & {
      detune?: { value: number }
    }
    if (sampler.detune) sampler.detune.value = detune
  })
}

export async function startWesternNote(western: string): Promise<() => void> {
  const player = await getPlayer()
  if (!player) return () => undefined
  const now = player.Tone.now()
  const pitch = soundingNote(western)
  player.sampler.triggerAttack(pitch, now)
  return () => {
    player.sampler.triggerRelease(pitch, player.Tone.now())
  }
}

export function stopActiveWesternNote(): void {
  void getPlayer().then((player) => {
    player?.sampler.releaseAll()
  })
  droneNotes = []
}

export async function playWesternNote(western: string, durationSec = 0.45): Promise<void> {
  const player = await getPlayer()
  if (!player) return
  player.sampler.triggerAttackRelease(soundingNote(western), durationSec, player.Tone.now())
}

export async function playSheetEvents(events: SheetPlayEvent[]): Promise<void> {
  return playSheetOnTransport(events)
}

export function pauseHarmoniumSheet(): void {
  const player = cachedPlayer
  if (!player) return
  player.Tone.Transport.pause()
  player.sampler.releaseAll()
}

export function resumeHarmoniumSheet(): void {
  cachedPlayer?.Tone.Transport.start()
}

export function stopHarmoniumSheet(): void {
  playbackGeneration += 1
  const player = cachedPlayer
  if (player) {
    player.Tone.Transport.stop()
    player.Tone.Transport.cancel()
    player.sampler.releaseAll()
  }
  sheetFinished?.()
  sheetFinished = null
}

export function getHarmoniumSheetSeconds(): number {
  return cachedPlayer?.Tone.Transport.seconds ?? 0
}

function sheetEndSec(events: SheetPlayEvent[]): number {
  const last = events[events.length - 1]
  return last ? last.startSec + last.durationSec + 0.08 : 0
}

function scheduleSheetEvents(player: Player, events: SheetPlayEvent[], gen: number): number {
  for (const event of events) {
    player.Tone.Transport.schedule((time) => {
      if (gen !== playbackGeneration) return
      player.sampler.triggerAttackRelease(soundingNote(event.western), event.durationSec, time)
    }, event.startSec)
  }
  const endSec = sheetEndSec(events)
  player.Tone.Transport.scheduleOnce(() => {
    if (gen !== playbackGeneration) return
    const done = sheetFinished
    sheetFinished = null
    done?.()
  }, endSec)
  return endSec
}

/** Rebuild the playing sheet at a new tempo, keeping the same place in the song. */
export function retargetHarmoniumSheet(events: SheetPlayEvent[], seconds: number, shouldPlay: boolean): void {
  const player = cachedPlayer
  if (!player || !events.length) return
  const gen = playbackGeneration
  player.Tone.Transport.pause()
  player.Tone.Transport.cancel()
  player.sampler.releaseAll()
  const endSec = scheduleSheetEvents(player, events, gen)
  const clipped = Math.max(0, Math.min(seconds, endSec))
  player.Tone.Transport.seconds = clipped
  if (shouldPlay) {
    for (const event of events) {
      if (clipped < event.startSec || clipped >= event.startSec + event.durationSec) continue
      player.sampler.triggerAttackRelease(
        soundingNote(event.western),
        event.startSec + event.durationSec - clipped,
        player.Tone.now(),
      )
    }
    player.Tone.Transport.start()
  }
}

export async function playSheetOnTransport(events: SheetPlayEvent[]): Promise<void> {
  const player = await getPlayer()
  if (!player || !events.length) return
  const gen = playbackGeneration + 1
  playbackGeneration = gen
  player.Tone.Transport.stop()
  player.Tone.Transport.cancel()
  player.Tone.Transport.seconds = 0
  scheduleSheetEvents(player, events, gen)
  await new Promise<void>((resolve) => {
    sheetFinished = resolve
    player.Tone.Transport.start()
  })
}

export async function startHarmoniumDrone(tonic: string): Promise<void> {
  const player = await getPlayer()
  if (!player) return
  stopHarmoniumDrone()
  const sa = swaraToWestern(tonic, "S", "middle")
  const pa = swaraToWestern(tonic, "P", "middle")
  droneNotes = [sa, pa]
    .filter((note): note is string => Boolean(note))
    .map((note) => soundingNote(note))
  if (!droneNotes.length) return
  player.sampler.triggerAttack(droneNotes, player.Tone.now())
}

export function stopHarmoniumDrone(): void {
  if (!droneNotes.length) return
  const notes = droneNotes
  droneNotes = []
  void getPlayer().then((player) => {
    if (!player) return
    player.sampler.triggerRelease(notes, player.Tone.now())
  })
}
