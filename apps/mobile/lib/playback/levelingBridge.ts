import { createLeveler, type Leveler } from "@/lib/loudness/leveler"
import type { CatalogTrack } from "@/lib/playback/catalogTrack"
import { createTransitionFader, type TransitionFader } from "@/lib/playback/transitionFade"
import { getTrackPlayer, loadTrackPlayerModule } from "@/lib/playback/trackPlayerBridge"
import { isLevelingEnabled, useLoudnessStore } from "@/stores/loudnessStore"

/**
 * Connects the volume leveler (lib/loudness/leveler.ts) to the native player (RNTP).
 *
 * The leveler decides; this file only gives it the one real volume to set and the two events it needs
 * (the active track changed, progress), and calls it when the listener flips the switch. Everything
 * here is optional by design: when a call fails or the player has no such event, the music plays
 * unchanged at the listener's own volume.
 */

let leveler: Leveler | null = null
/** The id of the track the player last said is active (progress events do not carry it). */
let activeTrackIdHint: string | null = null
let hooked = false
let unsubscribeStore: (() => void) | null = null

/**
 * What the smooth-transition fader needs to know about the app (set once by lib/playerV2/services.ts; kept
 * as a hook so this file does not import the player store, which imports this file).
 */
export type TransitionContext = {
  /** Fade length for what plays now (radio or list setting): 0 = off. */
  getSeconds: () => number
  hasNext: () => boolean
  getRate: () => number
}
let transitionContext: TransitionContext | null = null
let fader: TransitionFader | null = null

export function setTransitionContext(context: TransitionContext | null): void {
  transitionContext = context
}

export function getTransitionFader(): TransitionFader {
  if (fader) return fader
  fader = createTransitionFader({
    getSeconds: () => transitionContext?.getSeconds() ?? 0,
    hasNext: () => transitionContext?.hasNext() ?? false,
    getRate: () => transitionContext?.getRate() ?? 1,
    apply: (factor) => getLeveler().setFade(factor),
  })
  return fader
}

export function getLeveler(): Leveler {
  if (leveler) return leveler
  leveler = createLeveler({
    setVolume: (volume) => {
      try {
        void Promise.resolve(getTrackPlayer().setVolume(volume)).catch(() => undefined)
      } catch {
        /* the player is not ready: the next track start sets it */
      }
    },
    isEnabled: isLevelingEnabled,
    canBoost: () => false,
  })
  return leveler
}

/** Called once the native player is set up. Safe to call again. */
export function attachLevelingListeners(): void {
  if (hooked) return
  hooked = true
  try {
    const { Event } = loadTrackPlayerModule()
    const player = getTrackPlayer()
    if (typeof player.addEventListener !== "function") return
    player.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
      const id = typeof event.track?.id === "string" ? event.track.id : null
      activeTrackIdHint = id
      getLeveler().onActiveTrackChanged(id)
      getTransitionFader().onTrackChanged(changedByUser(event))
    })
    player.addEventListener(
      Event.PlaybackProgressUpdated,
      (event: { position?: number; duration?: number }) => {
        const position = Number(event.position) || 0
        const duration = Number(event.duration) || 0
        getLeveler().onProgress(activeTrackIdHint, position, duration)
        getTransitionFader().onProgress(position, duration)
      },
    )
  } catch {
    hooked = false
  }
  unsubscribeStore?.()
  unsubscribeStore = useLoudnessStore.subscribe((state, previous) => {
    if (state.enabled !== previous.enabled) getLeveler().refresh()
  })
}

/**
 * Did the listener move to another track (Next, Previous, a tap in the queue), as opposed to the track
 * ending by itself? The event tells where the old one was left; near its end it is a natural change.
 */
function changedByUser(event: { lastPosition?: number; lastTrack?: { duration?: number } | null }): boolean {
  const left = Number(event.lastPosition)
  const length = Number(event.lastTrack?.duration)
  if (!Number.isFinite(left) || !(length > 0)) return false
  return left < length - 3
}

export function levelStartTrack(track: CatalogTrack): void {
  // a track the app loads itself: if the last one was fading out toward its end this is the next one coming
  // in; otherwise (a tap, Next from the screen) it starts at full volume
  getTransitionFader().onTrackChanged(false)
  activeTrackIdHint = track.id
  getLeveler().startTrack(track)
}

export function levelNoteUpcoming(track: CatalogTrack): void {
  getLeveler().noteUpcoming(track)
}

export function levelSetUserVolume(volume: number): void {
  getLeveler().setUserVolume(volume)
}

export function levelReset(): void {
  getTransitionFader().reset()
  activeTrackIdHint = null
  getLeveler().reset()
}
