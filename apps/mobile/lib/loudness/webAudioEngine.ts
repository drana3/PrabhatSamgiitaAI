import {
  DEFAULT_CROSSFADE_SECONDS,
  equalPowerCurves,
  fadeIsDue,
  planTransition,
  shouldPreload,
  type TransitionPlan,
} from "@/lib/loudness/crossfade"
import { computeLevel, dbToGain, type LevelResult } from "@/lib/loudness/levels"
import { loudnessInfoFrom } from "@/lib/loudness/songLevel"
import type { CatalogTrack } from "@/lib/playback/catalogTrack"

/**
 * A two-deck player on the Web Audio API: preloads the next track, levels both, and crossfades.
 *
 * What it does that the phone's player (RNTP) cannot: two tracks play at once for an equal-power
 * crossfade, and a quiet track can be raised above the level of its file (a gain above 1, up to the
 * true-peak ceiling). Same decisions as the phone (lib/loudness/levels.ts, crossfade.ts), only a
 * stronger engine. Each deck is a chain:
 *
 *   <audio> -> MediaElementSource -> fade gain -> level gain -> master gain -> output
 *
 * There is no limiter: a boost is already capped by the measured true peak (`computeLevel`), which
 * keeps every track under -1 dBTP. (Chrome's DynamicsCompressorNode was tried and dropped: it adds
 * automatic makeup gain that cannot be switched off.)
 *
 * Everything the browser provides (audio context, audio elements, timers) is injected, so the logic is
 * tested without a browser; the same code was run in headless Chromium with synthetic tones.
 *
 * Status: built and tested, but the app has no real web player yet (the web preview is a simulated
 * player with no sound), so nothing in the app starts it. It is the engine for a real web player
 * and the reference for a native engine with overlap (docs/loudness-leveling.md).
 */

export type AudioParamLike = {
  value: number
  setValueAtTime: (value: number, at: number) => unknown
  setValueCurveAtTime: (values: Float32Array, at: number, duration: number) => unknown
  cancelScheduledValues: (at: number) => unknown
  setTargetAtTime?: (value: number, at: number, timeConstant: number) => unknown
}

export type AudioNodeLike = {
  connect: (to: unknown) => unknown
  disconnect?: () => void
}

export type GainNodeLike = AudioNodeLike & { gain: AudioParamLike }

export type AudioContextLike = {
  currentTime: number
  state?: string
  destination: unknown
  resume?: () => Promise<void>
  createGain: () => GainNodeLike
  createMediaElementSource: (element: unknown) => AudioNodeLike
}

export type AudioElementLike = {
  src: string
  currentTime: number
  duration: number
  paused: boolean
  ended?: boolean
  readyState?: number
  preload?: string
  crossOrigin?: string | null
  play: () => Promise<void> | void
  pause: () => void
  load?: () => void
  addEventListener: (type: string, listener: () => void) => void
}

export type WebAudioDeps = {
  createContext: () => AudioContextLike
  createElement: () => AudioElementLike
  /** Where the engine's output goes. Default: the context destination. Tests tap it here. */
  connectOutput?: (ctx: AudioContextLike, node: AudioNodeLike) => void
  setInterval?: (run: () => void, ms: number) => unknown
  clearInterval?: (handle: unknown) => void
}

export type WebAudioOptions = {
  /** Is volume leveling on? Read at every decision. */
  isEnabled?: () => boolean
  /** Requested crossfade length in seconds (1 to 3). Default 2. */
  crossfadeSeconds?: () => number
  /** Crossfade on or off (the Radio uses it; a plain list too). */
  crossfade?: () => boolean
}

type Deck = {
  element: AudioElementLike
  fade: GainNodeLike
  level: GainNodeLike
  track: CatalogTrack | null
  levelResult: LevelResult | null
  loaded: boolean
}

export type WebAudioEngine = {
  /** Starts `track` now; `upcoming` is the one behind it (preloaded when due). */
  play: (track: CatalogTrack, upcoming?: CatalogTrack | null) => Promise<void>
  setUpcoming: (track: CatalogTrack | null) => void
  pause: () => void
  resume: () => Promise<void>
  /** The listener's own volume, 0 to 1 (the master gain). */
  setVolume: (volume: number) => void
  /** Re-applies the gains of the active deck (the leveling switch changed). */
  refresh: () => void
  /** One step of the scheduler; the engine calls it every 100 ms, tests call it by hand. */
  tick: () => void
  onTrackChange: (listener: (track: CatalogTrack) => void) => void
  /** What is going on, for tests and the board. */
  state: () => {
    active: string | null
    fading: boolean
    activeGainDb: number | null
    plan: TransitionPlan | null
  }
  destroy: () => void
}

const TICK_MS = 100
/** After the fade ends the old deck is stopped this much later (seconds), so the tail is never cut. */
const FADE_TAIL_SECONDS = 0.15

export function createWebAudioEngine(deps: WebAudioDeps, options: WebAudioOptions = {}): WebAudioEngine {
  const isEnabled = options.isEnabled ?? (() => true)
  const crossfadeOn = options.crossfade ?? (() => true)
  const requestedSeconds = options.crossfadeSeconds ?? (() => DEFAULT_CROSSFADE_SECONDS)

  const ctx = deps.createContext()
  const master = ctx.createGain()
  // No compressor: Chrome's DynamicsCompressorNode adds automatic makeup gain (measured +1.7 dB with a
  // -3 dB threshold) that cannot be switched off, so it would raise the level it is meant to guard.
  // The boost is limited by the measured true peak instead (`computeLevel`).
  if (deps.connectOutput) deps.connectOutput(ctx, master)
  else master.connect(ctx.destination)

  const curves = equalPowerCurves(64)
  const listeners: Array<(track: CatalogTrack) => void> = []
  const makeDeck = (): Deck => {
    const element = deps.createElement()
    element.preload = "auto"
    element.crossOrigin = "anonymous"
    const fade = ctx.createGain()
    const level = ctx.createGain()
    const source = ctx.createMediaElementSource(element)
    source.connect(fade)
    fade.connect(level)
    level.connect(master)
    return { element, fade, level, track: null, levelResult: null, loaded: false }
  }
  let active = makeDeck()
  let idle = makeDeck()
  let upcoming: CatalogTrack | null = null
  let fadeEndsAt: number | null = null
  let plan: TransitionPlan | null = null
  let timer: unknown = null
  let wantPlaying = false

  const setIntervalFn = deps.setInterval ?? ((run, ms) => setInterval(run, ms))
  const clearIntervalFn = deps.clearInterval ?? ((h) => clearInterval(h as ReturnType<typeof setInterval>))

  function levelOf(track: CatalogTrack): LevelResult {
    return computeLevel({
      enabled: isEnabled(),
      info: loudnessInfoFrom({ loudnessLufs: track.loudnessLufs, truePeakDb: track.truePeakDb }),
      cls: track.loudnessClass ?? "music",
      canBoost: true,
    })
  }

  function applyLevel(deck: Deck, track: CatalogTrack, smooth = false) {
    deck.track = track
    deck.levelResult = levelOf(track)
    const gain = dbToGain(deck.levelResult.gainDb)
    deck.level.gain.cancelScheduledValues(ctx.currentTime)
    // Before a deck is heard the value is set outright; while it plays (the switch was flipped) it glides, so no click.
    if (smooth && deck.level.gain.setTargetAtTime) deck.level.gain.setTargetAtTime(gain, ctx.currentTime, 0.06)
    else deck.level.gain.setValueAtTime(gain, ctx.currentTime)
  }

  function load(deck: Deck, track: CatalogTrack) {
    deck.loaded = false
    applyLevel(deck, track)
    deck.fade.gain.cancelScheduledValues(ctx.currentTime)
    deck.fade.gain.setValueAtTime(1, ctx.currentTime)
    deck.element.src = track.url
    deck.element.load?.()
    deck.loaded = true
  }

  function factsOf(track: CatalogTrack, deck: Deck | null, duration: number | null) {
    const result = deck?.levelResult ?? levelOf(track)
    return {
      duration: duration ?? null,
      cls: track.loudnessClass ?? ("music" as const),
      levelledLufs:
        typeof track.loudnessLufs === "number" && Number.isFinite(track.loudnessLufs)
          ? track.loudnessLufs + result.gainDb
          : null,
    }
  }

  function startIdle(fadeIn: boolean, fadeSeconds: number) {
    // The idle deck becomes the one that plays; `active` is what is leaving (or has ended).
    const leaving = active
    const arriving = idle
    const startAt = ctx.currentTime
    if (fadeIn) {
      leaving.fade.gain.cancelScheduledValues(startAt)
      leaving.fade.gain.setValueCurveAtTime(curves.out, startAt, fadeSeconds)
      arriving.fade.gain.cancelScheduledValues(startAt)
      arriving.fade.gain.setValueCurveAtTime(curves.in, startAt, fadeSeconds)
      fadeEndsAt = startAt + fadeSeconds + FADE_TAIL_SECONDS
    } else {
      arriving.fade.gain.cancelScheduledValues(startAt)
      arriving.fade.gain.setValueAtTime(1, startAt)
    }
    void arriving.element.play()
    active = arriving
    idle = leaving
    upcoming = null
    plan = null
    if (arriving.track) for (const listener of listeners) listener(arriving.track)
    if (!fadeIn) retire(leaving)
  }

  function retire(deck: Deck) {
    deck.element.pause()
    deck.loaded = false
    deck.track = null
    deck.levelResult = null
  }

  function tick() {
    if (!wantPlaying) return
    const now = ctx.currentTime
    if (fadeEndsAt !== null) {
      if (now >= fadeEndsAt) {
        fadeEndsAt = null
        retire(idle)
      }
      return
    }
    const track = active.track
    if (!track) return
    const position = active.element.currentTime
    const elementDuration = Number.isFinite(active.element.duration) ? active.element.duration : 0
    const duration = elementDuration > 0 ? elementDuration : (track.duration ?? 0)

    if (upcoming && idle.track?.id !== upcoming.id) {
      if (shouldPreload({ position, duration: duration || null, hasNext: true, alreadyLoaded: false })) {
        load(idle, upcoming)
      }
    }
    if (!upcoming || idle.track?.id !== upcoming.id) {
      plan = upcoming ? null : { mode: "gapless", reason: "no-next" }
      return
    }
    const idleDuration = Number.isFinite(idle.element.duration) && idle.element.duration > 0 ? idle.element.duration : (upcoming.duration ?? 0)
    plan = planTransition({
      current: factsOf(track, active, duration || null),
      next: factsOf(upcoming, idle, idleDuration || null),
      requestedSeconds: requestedSeconds(),
      enabled: crossfadeOn() && isEnabled(),
    })
    if (plan.mode === "crossfade") {
      if (fadeIsDue(plan, position)) startIdle(true, plan.fadeSeconds)
      return
    }
    // Gapless: the next deck is ready; it starts the moment this one ends.
    if (active.element.ended || (duration > 0 && position >= duration - 0.05)) startIdle(false, 0)
  }

  return {
    async play(track, next = null) {
      if (fadeEndsAt !== null) {
        fadeEndsAt = null
        retire(idle)
      }
      load(active, track)
      active.fade.gain.setValueAtTime(1, ctx.currentTime)
      upcoming = next
      plan = null
      idle.loaded = false
      if (ctx.state === "suspended") await ctx.resume?.()
      wantPlaying = true
      await active.element.play()
      if (timer === null) timer = setIntervalFn(tick, TICK_MS)
    },
    setUpcoming(track) {
      upcoming = track
      if (idle.track && track?.id !== idle.track.id && fadeEndsAt === null) retire(idle)
    },
    pause() {
      wantPlaying = false
      active.element.pause()
      if (fadeEndsAt !== null) idle.element.pause()
    },
    async resume() {
      if (ctx.state === "suspended") await ctx.resume?.()
      wantPlaying = true
      await active.element.play()
      if (fadeEndsAt !== null) await idle.element.play()
    },
    setVolume(volume) {
      const v = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.setValueAtTime(v, ctx.currentTime)
    },
    refresh() {
      if (active.track) applyLevel(active, active.track, true)
      if (idle.track) applyLevel(idle, idle.track, true)
    },
    tick,
    onTrackChange(listener) {
      listeners.push(listener)
    },
    state: () => ({
      active: active.track?.id ?? null,
      fading: fadeEndsAt !== null,
      activeGainDb: active.levelResult?.gainDb ?? null,
      plan,
    }),
    destroy() {
      wantPlaying = false
      if (timer !== null) clearIntervalFn(timer)
      timer = null
      active.element.pause()
      idle.element.pause()
    },
  }
}

