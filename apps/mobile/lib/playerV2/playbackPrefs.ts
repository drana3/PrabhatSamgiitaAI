import { clampRate } from "@/lib/playerV2/playbackSpeed"

/**
 * What the listener chose about speed, pitch and track-to-track transitions, kept on this phone (nothing is sent).
 * Pure helpers; the persisted store is stores/playbackPrefsStore.ts.
 */

/** "Smooth transitions": the fade at the end of one track and at the start of the next, 0 (off) to 6 seconds. */
export const TRANSITION_MIN_SECONDS = 0
export const TRANSITION_MAX_SECONDS = 6
export const TRANSITION_STEP_SECONDS = 0.5
/** On in the Radio (Dada's decision), off in lists and queues until the listener turns it on. */
export const DEFAULT_RADIO_TRANSITION_SECONDS = 2
export const DEFAULT_LIST_TRANSITION_SECONDS = 0

export function clampTransitionSeconds(value: unknown, fallback = 0): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback
  const snapped = Math.round(n / TRANSITION_STEP_SECONDS) * TRANSITION_STEP_SECONDS
  return Math.min(TRANSITION_MAX_SECONDS, Math.max(TRANSITION_MIN_SECONDS, snapped))
}

/** "Off" is 0; otherwise "2 s", "2.5 s". */
export function formatTransitionSeconds(seconds: number): string {
  return seconds <= 0 ? "" : `${seconds} s`
}

export type TrackRates = Record<string, { rate: number; at: number }>
export const MAX_TRACK_RATES = 200

/** The key a recording is remembered by: `ps:<number>` for a catalogue song, `rec:<id>` for an uploaded recording. */
export function trackKeyOf(song: { number: number; kind?: string; kiirtan?: { id?: string } | null | undefined }): string {
  if (song.kind === "kiirtan") return `rec:${song.kiirtan?.id ?? song.number}`
  return `ps:${song.number}`
}

/** The speed a track starts at: its own saved one, else the listener's default. */
export function startRateFor(input: { key: string; rates: TrackRates; defaultRate: number }): number {
  const own = input.rates[input.key]
  return clampRate(own ? own.rate : input.defaultRate)
}

/** Remember `rate` for one track (or forget it when `rate` is null). The oldest entries go first past the limit. */
export function withTrackRate(rates: TrackRates, key: string, rate: number | null, now: number, max = MAX_TRACK_RATES): TrackRates {
  const next: TrackRates = { ...rates }
  if (rate === null) {
    delete next[key]
    return next
  }
  next[key] = { rate: clampRate(rate), at: now }
  const keys = Object.keys(next)
  if (keys.length > max) {
    keys
      .sort((a, b) => (next[a]?.at ?? 0) - (next[b]?.at ?? 0))
      .slice(0, keys.length - max)
      .forEach((k) => delete next[k])
  }
  return next
}

/** Anything damaged in storage falls back to the default; nothing throws. */
export function sanitizeTrackRates(raw: unknown): TrackRates {
  if (!raw || typeof raw !== "object") return {}
  const out: TrackRates = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const v = value as { rate?: unknown; at?: unknown } | null
    if (v && typeof v.rate === "number" && Number.isFinite(v.rate)) out[key] = { rate: clampRate(v.rate), at: typeof v.at === "number" ? v.at : 0 }
  }
  return out
}

/** The Radio is running: random order with auto-advance (the same test the mini player uses). */
export function isRadioRunning(state: { playbackMode: string; driveAutoAdvance: boolean }): boolean {
  return state.playbackMode === "random" && state.driveAutoAdvance
}

/** Which "Smooth transitions" value applies now: the Radio has its own, lists and queues another. */
export function transitionSecondsFor(input: { radio: boolean; radioSeconds: number; listSeconds: number }): number {
  return input.radio ? input.radioSeconds : input.listSeconds
}
