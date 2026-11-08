import { createLeveler, type Leveler } from "@/lib/loudness/leveler"
import type { CatalogTrack } from "@/lib/playback/catalogTrack"
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
    })
    player.addEventListener(
      Event.PlaybackProgressUpdated,
      (event: { position?: number; duration?: number }) => {
        getLeveler().onProgress(activeTrackIdHint, Number(event.position) || 0, Number(event.duration) || 0)
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

export function levelStartTrack(track: CatalogTrack): void {
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
  activeTrackIdHint = null
  getLeveler().reset()
}
