import {
  harmoniumSampleUrl,
  reedWavDataUri,
  type SheetPlayEvent,
  westernToHz,
} from "@prabhat/core"

let sharedContext: AudioContext | null = null
const bufferCache = new Map<string, AudioBuffer>()
const heldVoices = new Map<string, { stop: () => void }>()

async function getAudioContext(): Promise<AudioContext | null> {
  if (typeof window === "undefined") return null
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null
  if (!sharedContext) sharedContext = new AudioContextClass()
  await sharedContext.resume()
  return sharedContext
}

async function loadSampleBuffer(context: AudioContext, western: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(western)
  if (cached) return cached

  const url = harmoniumSampleUrl(western)
  if (url) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        const decoded = await context.decodeAudioData(await response.arrayBuffer())
        bufferCache.set(western, decoded)
        return decoded
      }
    } catch {
      /* fallback below */
    }
  }

  const hz = westernToHz(western)
  if (!hz) return null
  try {
    const response = await fetch(reedWavDataUri(hz, 0.95))
    const decoded = await context.decodeAudioData(await response.arrayBuffer())
    bufferCache.set(western, decoded)
    return decoded
  } catch {
    return null
  }
}

function playBuffer(
  context: AudioContext,
  buffer: AudioBuffer,
  durationSec: number,
  startAt = context.currentTime + 0.01,
): () => void {
  const source = context.createBufferSource()
  const gain = context.createGain()
  const lowpass = context.createBiquadFilter()
  lowpass.type = "lowpass"
  lowpass.frequency.value = 2800
  lowpass.Q.value = 0.5
  source.buffer = buffer
  const playDuration = Math.min(durationSec, buffer.duration)
  gain.gain.setValueAtTime(0.5, startAt)
  gain.gain.setValueAtTime(0.5, startAt + Math.max(0, playDuration - 0.04))
  gain.gain.linearRampToValueAtTime(0.001, startAt + playDuration)
  source.connect(lowpass).connect(gain).connect(context.destination)
  source.start(startAt, 0, playDuration)
  return () => {
    try {
      source.stop()
    } catch {
      /* already stopped */
    }
  }
}

function fadeStop(context: AudioContext, gain: GainNode, stopNode: AudioScheduledSourceNode): () => void {
  return () => {
    const now = context.currentTime
    try {
      gain.gain.cancelScheduledValues(now)
      const current = Math.max(gain.gain.value, 0.001)
      gain.gain.setValueAtTime(current, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)
      stopNode.stop(now + 0.1)
    } catch {
      /* already stopped */
    }
  }
}

function startHeldBuffer(context: AudioContext, buffer: AudioBuffer): () => void {
  const source = context.createBufferSource()
  const gain = context.createGain()
  const lowpass = context.createBiquadFilter()
  lowpass.type = "lowpass"
  lowpass.frequency.value = 2800
  lowpass.Q.value = 0.5
  source.buffer = buffer
  source.loop = true
  const loopStart = Math.min(0.07, Math.max(0.02, buffer.duration * 0.08))
  const loopEnd = Math.min(buffer.duration - 0.04, Math.max(loopStart + 0.2, buffer.duration * 0.72))
  source.loopStart = loopStart
  source.loopEnd = loopEnd
  const now = context.currentTime
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.34, now + 0.025)
  source.connect(lowpass).connect(gain).connect(context.destination)
  source.start(now)
  return fadeStop(context, gain, source)
}

function startHeldOscillator(context: AudioContext, frequencyHz: number): () => void {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const lowpass = context.createBiquadFilter()
  lowpass.type = "lowpass"
  lowpass.frequency.value = 2800
  oscillator.type = "triangle"
  oscillator.frequency.value = frequencyHz
  const now = context.currentTime
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.03)
  oscillator.connect(lowpass).connect(gain).connect(context.destination)
  oscillator.start(now)
  return fadeStop(context, gain, oscillator)
}

function playOscillator(context: AudioContext, frequencyHz: number, durationSec: number, startAt: number): () => void {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const lowpass = context.createBiquadFilter()
  lowpass.type = "lowpass"
  lowpass.frequency.value = 2800
  oscillator.type = "triangle"
  oscillator.frequency.value = frequencyHz
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.08, startAt + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec)
  oscillator.connect(lowpass).connect(gain).connect(context.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + durationSec + 0.02)
  return () => {
    try {
      oscillator.stop()
    } catch {
      /* already stopped */
    }
  }
}

export async function playWesternNote(western: string, durationSec = 0.45): Promise<void> {
  const context = await getAudioContext()
  if (!context) return
  const buffer = await loadSampleBuffer(context, western)
  if (buffer) {
    playBuffer(context, buffer, durationSec)
    return
  }
  const hz = westernToHz(western)
  if (!hz) return
  playOscillator(context, hz, durationSec, context.currentTime + 0.01)
}

export async function startWesternNote(western: string): Promise<() => void> {
  heldVoices.get(western)?.stop()
  heldVoices.delete(western)

  const context = await getAudioContext()
  if (!context) return () => undefined

  const buffer = await loadSampleBuffer(context, western)
  const stop = buffer
    ? startHeldBuffer(context, buffer)
    : (() => {
        const hz = westernToHz(western)
        return hz ? startHeldOscillator(context, hz) : () => undefined
      })()

  heldVoices.set(western, { stop })
  return () => {
    stop()
    if (heldVoices.get(western)?.stop === stop) heldVoices.delete(western)
  }
}

export function stopActiveWesternNote(): void {
  for (const voice of heldVoices.values()) voice.stop()
  heldVoices.clear()
}

export async function playSheetEvents(events: SheetPlayEvent[]): Promise<void> {
  const context = await getAudioContext()
  if (!context || !events.length) return

  const buffers = await Promise.all(events.map((event) => loadSampleBuffer(context, event.western)))
  const baseTime = context.currentTime + 0.05

  events.forEach((event, index) => {
    const start = baseTime + event.startSec
    const buffer = buffers[index]
    if (buffer) {
      playBuffer(context, buffer, event.durationSec, start)
      return
    }
    const hz = westernToHz(event.western)
    if (hz) playOscillator(context, hz, event.durationSec, start)
  })
}
