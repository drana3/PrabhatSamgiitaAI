/**
 * Crossfade between two tracks, and the plan for when to start it. Pure.
 *
 * Why equal power: when two different recordings play at once, their powers add. Linear fades
 * (0.5 and 0.5 in the middle) give a power of 0.25 + 0.25 = 0.5, which is a dip of 3 dB exactly
 * where the tracks cross. Fades along a quarter sine and cosine (0.707 and 0.707) add up to a
 * power of 1: the loudness stays level through the whole transition.
 */
import type { LoudnessClass } from "@/lib/loudness/levels"

/** Fade length range of the Radio: short, only to hide the join (Apple Music allows 1 to 12 s). */
export const MIN_CROSSFADE_SECONDS = 1
export const MAX_CROSSFADE_SECONDS = 3
export const DEFAULT_CROSSFADE_SECONDS = 2
/** Two levelled tracks further apart than this (in dB, after the gains) are not overlapped. */
export const MAX_LEVEL_GAP_DB = 4
/** A fade never takes more than this share of the shorter track. */
export const MAX_FADE_SHARE = 0.2
/** Start loading the next track this long before the current one ends. */
export const PRELOAD_LEAD_SECONDS = 25

/** Gains of the track that ends and the track that starts, at progress t from 0 to 1. */
export function equalPowerGains(t: number): { out: number; in: number } {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0))
  return { out: Math.cos((x * Math.PI) / 2), in: Math.sin((x * Math.PI) / 2) }
}

export function linearGains(t: number): { out: number; in: number } {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0))
  return { out: 1 - x, in: x }
}

/** Total power of the two tracks when they are uncorrelated (what the ear hears as loudness). */
export function mixedPower(gains: { out: number; in: number }): number {
  return gains.out * gains.out + gains.in * gains.in
}

/** The two fade curves as arrays for `AudioParam.setValueCurveAtTime` (at least 2 values each). */
export function equalPowerCurves(points = 64): { out: Float32Array; in: Float32Array } {
  const count = Math.max(2, Math.floor(points))
  const out = new Float32Array(count)
  const into = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    const g = equalPowerGains(i / (count - 1))
    out[i] = g.out
    into[i] = g.in
  }
  return { out, in: into }
}

export function clampCrossfadeSeconds(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_CROSSFADE_SECONDS
  return Math.min(MAX_CROSSFADE_SECONDS, Math.max(MIN_CROSSFADE_SECONDS, n))
}

export type TrackFacts = {
  /** seconds; 0 or null when unknown */
  duration: number | null
  cls: LoudnessClass
  /** loudness after the leveling gain, in LUFS; null when the track is not measured */
  levelledLufs: number | null
}

export type TransitionPlan =
  | { mode: "crossfade"; fadeSeconds: number; startAtSeconds: number }
  /** the next track starts when this one ends (gapless), with no overlap */
  | { mode: "gapless"; reason: "disabled" | "unknown-length" | "too-short" | "class-change" | "level-gap" | "no-next" }

/**
 * What to do at the end of `current` when `next` follows.
 *  - Crossfade only between tracks of one class: a discourse is never mixed into music.
 *  - Only when the levels are known to be close (leveling on and both measured, within
 *    MAX_LEVEL_GAP_DB): overlapping a loud and a quiet track would make a swell, not a blend.
 *  - Never longer than a fifth of the shorter track, and not for tracks of unknown length.
 */
export function planTransition(input: {
  current: TrackFacts
  next: TrackFacts | null
  requestedSeconds: number
  enabled: boolean
}): TransitionPlan {
  const { current, next } = input
  if (!next) return { mode: "gapless", reason: "no-next" }
  if (!input.enabled) return { mode: "gapless", reason: "disabled" }
  const a = current.duration ?? 0
  const b = next.duration ?? 0
  if (!(a > 0) || !(b > 0)) return { mode: "gapless", reason: "unknown-length" }
  if (current.cls !== next.cls) return { mode: "gapless", reason: "class-change" }
  if (
    current.levelledLufs === null ||
    next.levelledLufs === null ||
    Math.abs(current.levelledLufs - next.levelledLufs) > MAX_LEVEL_GAP_DB
  ) {
    return { mode: "gapless", reason: "level-gap" }
  }
  const fadeSeconds = Math.min(clampCrossfadeSeconds(input.requestedSeconds), Math.min(a, b) * MAX_FADE_SHARE)
  if (fadeSeconds < MIN_CROSSFADE_SECONDS * 0.5) return { mode: "gapless", reason: "too-short" }
  return { mode: "crossfade", fadeSeconds, startAtSeconds: a - fadeSeconds }
}

/** True when the next track should be loaded now so that it is ready when the fade starts. */
export function shouldPreload(input: {
  position: number
  duration: number | null
  hasNext: boolean
  alreadyLoaded: boolean
}): boolean {
  if (!input.hasNext || input.alreadyLoaded) return false
  const duration = input.duration ?? 0
  if (!(duration > 0)) return input.position >= 5
  // Short tracks: from the middle; long ones: with PRELOAD_LEAD_SECONDS to go.
  return duration - input.position <= Math.min(PRELOAD_LEAD_SECONDS, duration / 2)
}

/** True when the fade of `plan` is due at this position of the current track. */
export function fadeIsDue(plan: TransitionPlan, position: number): boolean {
  return plan.mode === "crossfade" && position >= plan.startAtSeconds
}

/** Progress (0..1) of a running fade. */
export function fadeProgress(elapsedSeconds: number, fadeSeconds: number): number {
  if (!(fadeSeconds > 0)) return 1
  return Math.min(1, Math.max(0, elapsedSeconds / fadeSeconds))
}
