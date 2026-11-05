import { canGoNext, goNext, goPrevious, type ControllerDeps } from "@/lib/playerV2/controller"
import { usePlayerStore } from "@/stores/playerStore"

/**
 * Next and Previous for every source of the command: the buttons in the
 * Player, the mini player swipe, the lock screen, headphones, the car and the
 * Android notification all call these two, so they behave the same everywhere.
 *
 * Behaviour at the ends of a list:
 * - Next on the last song stays where it is (the lock screen hides Next, see canSkipNext).
 *   With "repeat list" it wraps to the first song.
 * - Previous past 3 seconds restarts the song; on the first song it restarts it too.
 *
 * The real wiring (stores, catalog) is registered by startPlayerV2Services, so this module stays
 * light enough to be loaded by the headless playback service.
 */
let depsProvider: (() => ControllerDeps) | null = null

export function setTransportDeps(provider: (() => ControllerDeps) | null): void {
  depsProvider = provider
}

export function skipToNextSong(): void {
  if (depsProvider && goNext(depsProvider())) return
  usePlayerStore.getState().next()
}

export function skipToPreviousSong(): void {
  if (depsProvider && goPrevious(depsProvider())) return
  usePlayerStore.getState().previous()
}

/** Whether a Next command can do anything right now. */
export function canSkipNext(): boolean {
  if (!depsProvider) return true
  const state = usePlayerStore.getState()
  return state.playbackMode === "random" || canGoNext(depsProvider())
}
